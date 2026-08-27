import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import { checkRepository } from '../src/lib/check.mjs';
import { applyProposal, createProposal } from '../src/lib/proposals.mjs';
import { parseManagedBlocks, renderManagedBlock } from '../src/lib/managed-blocks.mjs';
import { walkRepository } from '../src/lib/repository-walk.mjs';

const root = new URL('../', import.meta.url).pathname;

function copyFixture(name) {
  const source = join(root, 'test', 'fixtures', name);
  const target = mkdtempSync(join(tmpdir(), `grounded-engineering-${name}-`));
  cpSync(source, target, { recursive: true });
  return target;
}

function reviewedDecisions(proposal) {
  return proposal.cards.map((card) => ({
    id: card.id,
    local_applicability: 'APPLICABLE',
    local_decision: 'ACCEPT',
  }));
}

function createAppliedRepository() {
  const targetRoot = copyFixture('apply-clean');
  const proposal = createProposal(targetRoot, {
    sourceRoot: root,
    packId: 'baseline',
    proposalId: '20260827-010000-a1b2c3d4',
  });
  applyProposal(targetRoot, proposal.proposal_id, {
    sourceRoot: root,
    confirm: true,
    decisions: reviewedDecisions(proposal),
  });
  const manifestPath = join(targetRoot, '.grounded-engineering', 'manifest.yaml');
  const manifest = parse(readFileSync(manifestPath, 'utf8'));
  return {
    targetRoot,
    manifestPath,
    targetPath: join(targetRoot, manifest.targets[0].path),
  };
}

function snapshotRepository(targetRoot) {
  const files = new Map();
  for (const path of walkRepository(targetRoot)) {
    files.set(relative(targetRoot, path), readFileSync(path, 'utf8'));
  }
  return files;
}

function assertReadOnly(targetRoot, action) {
  const before = snapshotRepository(targetRoot);
  const result = action();
  const after = snapshotRepository(targetRoot);
  assert.deepEqual(after, before);
  return result;
}

function rewriteManifest(targetRoot, mutate) {
  const manifestPath = join(targetRoot, '.grounded-engineering', 'manifest.yaml');
  const manifest = parse(readFileSync(manifestPath, 'utf8'));
  mutate(manifest);
  writeFileSync(manifestPath, stringify(manifest));
}

function replaceFirstManagedBlock(targetPath, replacementContent) {
  const text = readFileSync(targetPath, 'utf8');
  const [block] = parseManagedBlocks(text);
  const replacement = renderManagedBlock(block.cardId, replacementContent);
  writeFileSync(targetPath, `${text.slice(0, block.start)}${replacement}${text.slice(block.end)}`);
}

test('reports a clean applied repository', () => {
  const { targetRoot } = createAppliedRepository();

  const result = assertReadOnly(targetRoot, () => checkRepository(targetRoot, { sourceRoot: root }));

  assert.deepEqual(result, { ok: true, diagnostics: [] });
});

test('uses the manifest managed-block fingerprint as the expected target state', () => {
  const { targetRoot } = createAppliedRepository();
  const alternateSourceRoot = mkdtempSync(join(tmpdir(), 'ge-check-source-'));
  cpSync(root, alternateSourceRoot, { recursive: true });
  const cardPath = join(alternateSourceRoot, 'practices', 'repository-context', 'inspect-repository-first.md');
  const cardText = readFileSync(cardPath, 'utf8');
  writeFileSync(cardPath, cardText.replace(
    'agent_snippet: Before editing, inspect applicable instructions, repository status, structure, declared commands, and affected paths.',
    'agent_snippet: Use a deliberately different local rendering for this test.'
  ));

  try {
    const result = assertReadOnly(targetRoot, () => checkRepository(targetRoot, { sourceRoot: alternateSourceRoot }));
    assert.deepEqual(result, { ok: true, diagnostics: [] });
  } finally {
    rmSync(alternateSourceRoot, { recursive: true, force: true });
  }
});

test('reports a missing manifest', () => {
  const targetRoot = copyFixture('apply-clean');

  const result = assertReadOnly(targetRoot, () => checkRepository(targetRoot, { sourceRoot: root }));

  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics, [
    { code: 'MISSING_MANIFEST', message: 'Grounded Engineering manifest not found at .grounded-engineering/manifest.yaml.' },
  ]);
});

test('reports an invalid manifest', () => {
  const { targetRoot } = createAppliedRepository();
  rewriteManifest(targetRoot, (manifest) => {
    manifest.targets = [];
  });

  const result = assertReadOnly(targetRoot, () => checkRepository(targetRoot, { sourceRoot: root }));

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, 'INVALID_MANIFEST');
  assert.match(result.diagnostics[0].message, /targets/);
});

test('reports an unavailable pack', () => {
  const { targetRoot } = createAppliedRepository();
  rewriteManifest(targetRoot, (manifest) => {
    manifest.pack_id = 'missing-pack';
  });

  const result = assertReadOnly(targetRoot, () => checkRepository(targetRoot, { sourceRoot: root }));

  assert.deepEqual(result.diagnostics, [
    { code: 'PACK_UNAVAILABLE', message: 'Unable to load pack missing-pack from the installed CLI bundle.' },
  ]);
});

test('reports release and pack metadata mismatches', () => {
  const { targetRoot } = createAppliedRepository();
  rewriteManifest(targetRoot, (manifest) => {
    manifest.pack_version = '9.9.9';
    manifest.grounded_engineering_release = 'v9.9.9';
  });

  const result = assertReadOnly(targetRoot, () => checkRepository(targetRoot, { sourceRoot: root }));

  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics, [
    { code: 'PACK_METADATA_MISMATCH', message: 'Manifest pack metadata does not match the installed CLI bundle for baseline.' },
  ]);
});

test('reports changed card metadata and source references', () => {
  const { targetRoot } = createAppliedRepository();
  rewriteManifest(targetRoot, (manifest) => {
    manifest.cards[0].public_disposition = 'ADAPT';
    manifest.cards[0].source_refs = ['ALTERED-SOURCE-REF'];
  });

  const result = assertReadOnly(targetRoot, () => checkRepository(targetRoot, { sourceRoot: root }));

  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics, [
    { code: 'CARD_METADATA_MISMATCH', message: 'Manifest card metadata no longer matches the installed CLI bundle for GE-RC-001.' },
  ]);
});

test('reports a missing target file', () => {
  const { targetRoot, targetPath } = createAppliedRepository();
  rmSync(targetPath);
  assert.equal(existsSync(targetPath), false);

  const result = assertReadOnly(targetRoot, () => checkRepository(targetRoot, { sourceRoot: root }));

  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics, [
    { code: 'MISSING_TARGET', message: 'Managed target is missing: GROUNDED_ENGINEERING.md.' },
  ]);
});

test('reports malformed managed markers', () => {
  const { targetRoot, targetPath } = createAppliedRepository();
  writeFileSync(targetPath, '<!-- grounded-engineering:begin card=GE-RC-001 -->\nMissing the end marker.\n');

  const result = assertReadOnly(targetRoot, () => checkRepository(targetRoot, { sourceRoot: root }));

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, 'STRUCTURAL_CONFLICT');
  assert.match(result.diagnostics[0].message, /missing end marker/);
});

test('reports missing and extra managed blocks', () => {
  const missingBlockRepo = createAppliedRepository();
  const missingText = readFileSync(missingBlockRepo.targetPath, 'utf8');
  const missingBlocks = parseManagedBlocks(missingText);
  const lastBlock = missingBlocks.at(-1);
  writeFileSync(
    missingBlockRepo.targetPath,
    `${missingText.slice(0, lastBlock.start).trimEnd()}\n`
  );

  const missingResult = assertReadOnly(
    missingBlockRepo.targetRoot,
    () => checkRepository(missingBlockRepo.targetRoot, { sourceRoot: root })
  );
  assert.deepEqual(missingResult.diagnostics, [
    { code: 'MANAGED_CARD_SET_MISMATCH', message: 'Managed block set does not match the manifest for GROUNDED_ENGINEERING.md.' },
  ]);

  const extraBlockRepo = createAppliedRepository();
  const extraText = readFileSync(extraBlockRepo.targetPath, 'utf8');
  writeFileSync(
    extraBlockRepo.targetPath,
    `${extraText}\n${renderManagedBlock('GE-AS-001', 'Extra managed guidance for this test.')}\n`
  );

  const extraResult = assertReadOnly(
    extraBlockRepo.targetRoot,
    () => checkRepository(extraBlockRepo.targetRoot, { sourceRoot: root })
  );
  assert.deepEqual(extraResult.diagnostics, [
    { code: 'MANAGED_CARD_SET_MISMATCH', message: 'Managed block set does not match the manifest for GROUNDED_ENGINEERING.md.' },
  ]);
});

test('reports a changed managed block', () => {
  const { targetRoot, targetPath } = createAppliedRepository();
  replaceFirstManagedBlock(targetPath, 'Changed managed guidance for this test.');

  const result = assertReadOnly(targetRoot, () => checkRepository(targetRoot, { sourceRoot: root }));

  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics, [
    { code: 'MANAGED_BLOCK_CHANGED', message: 'Managed block content no longer matches the manifest for GROUNDED_ENGINEERING.md at card GE-RC-001.' },
  ]);
});

test('allows unmanaged prose edits outside the managed blocks', () => {
  const { targetRoot, targetPath } = createAppliedRepository();
  const text = readFileSync(targetPath, 'utf8');
  writeFileSync(targetPath, `Repository-owned introduction.\n\n${text}\nRepository-owned footer.\n`);

  const result = assertReadOnly(targetRoot, () => checkRepository(targetRoot, { sourceRoot: root }));

  assert.deepEqual(result, { ok: true, diagnostics: [] });
});
