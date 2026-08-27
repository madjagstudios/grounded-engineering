import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import { validateManifest } from '../src/lib/manifest.mjs';
import { parseManagedBlocks, renderManagedBlock } from '../src/lib/managed-blocks.mjs';
import { walkRepository } from '../src/lib/repository-walk.mjs';

const root = new URL('../', import.meta.url).pathname;
const bin = join(root, 'bin', 'grounded-engineering.mjs');

function copyFixture(name) {
  const source = join(root, 'test', 'fixtures', name);
  const target = mkdtempSync(join(tmpdir(), `grounded-engineering-${name}-`));
  cpSync(source, target, { recursive: true });
  return target;
}

function snapshot(directory) {
  return walkRepository(directory)
    .map((path) => [path.slice(directory.length + 1), readFileSync(path, 'utf8')]);
}

function run(targetRoot, ...args) {
  return spawnSync(process.execPath, [bin, ...args], { cwd: targetRoot, encoding: 'utf8' });
}

function proposalId(output) {
  return output.match(/20[0-9]{6}-[0-9]{6}-[0-9a-f]{8}/)?.[0];
}

function reviewProposal(targetRoot, id) {
  const path = join(targetRoot, '.grounded-engineering', 'proposals', id, 'proposal.yaml');
  const proposal = parse(readFileSync(path, 'utf8'));
  proposal.local_decisions = proposal.cards.map((card) => ({
    id: card.id,
    local_applicability: 'APPLICABLE',
    local_decision: 'ACCEPT',
  }));
  writeFileSync(path, stringify(proposal));
}

function createReviewedProposal(targetRoot, ...args) {
  const create = run(targetRoot, 'adopt', 'create', ...args);
  assert.equal(create.status, 0, create.stderr);
  const id = proposalId(create.stdout);
  assert.ok(id);
  reviewProposal(targetRoot, id);
  return id;
}

function replaceFirstManagedBlock(targetPath, replacementContent) {
  const text = readFileSync(targetPath, 'utf8');
  const [block] = parseManagedBlocks(text);
  const replacement = renderManagedBlock(block.cardId, replacementContent);
  writeFileSync(targetPath, `${text.slice(0, block.start)}${replacement}${text.slice(block.end)}`);
}

test('runs preview, create, review, apply, and stable regeneration on a clean fixture', () => {
  const targetRoot = copyFixture('e2e-clean');
  const beforePreview = snapshot(targetRoot);
  const preview = run(targetRoot, 'adopt', 'preview', '--profile', 'baseline');
  assert.equal(preview.status, 0, preview.stderr);
  assert.deepEqual(snapshot(targetRoot), beforePreview);

  const create = run(targetRoot, 'adopt', 'create', '--profile', 'baseline');
  assert.equal(create.status, 0, create.stderr);
  const id = proposalId(create.stdout);
  assert.ok(id);
  reviewProposal(targetRoot, id);

  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 0, apply.stderr);
  assert.equal(existsSync(join(targetRoot, 'GROUNDED_ENGINEERING.md')), true);
  const manifestPath = join(targetRoot, '.grounded-engineering', 'manifest.yaml');
  const manifest = parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(validateManifest(manifest, root).valid, true);

  const currentTarget = readFileSync(join(targetRoot, 'GROUNDED_ENGINEERING.md'), 'utf8');
  const secondCreate = run(targetRoot, 'adopt', 'create', '--profile', 'baseline');
  assert.equal(secondCreate.status, 0, secondCreate.stderr);
  const secondId = proposalId(secondCreate.stdout);
  const secondProposal = parse(readFileSync(join(targetRoot, '.grounded-engineering', 'proposals', secondId, 'proposal.yaml'), 'utf8'));
  assert.equal(secondProposal.targets[0].content, currentTarget);
});

test('generates a separate provider-neutral target beside existing policy surfaces', () => {
  const targetRoot = copyFixture('e2e-existing');
  const originalInstructions = readFileSync(join(targetRoot, 'AGENTS.md'), 'utf8');
  const originalPolicy = readFileSync(join(targetRoot, 'docs', 'engineering.md'), 'utf8');
  const create = run(targetRoot, 'adopt', 'create', '--profile', 'baseline');
  assert.equal(create.status, 0, create.stderr);
  const id = proposalId(create.stdout);
  reviewProposal(targetRoot, id);
  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 0, apply.stderr);
  assert.equal(readFileSync(join(targetRoot, 'AGENTS.md'), 'utf8'), originalInstructions);
  assert.equal(readFileSync(join(targetRoot, 'docs', 'engineering.md'), 'utf8'), originalPolicy);
  assert.equal(existsSync(join(targetRoot, 'docs', 'grounded-engineering.md')), true);
});

test('refuses a stale target with no partial writes', () => {
  const targetRoot = copyFixture('e2e-conflict');
  const originalManifest = join(targetRoot, '.grounded-engineering', 'manifest.yaml');
  const create = run(targetRoot, 'adopt', 'create', '--profile', 'baseline');
  assert.equal(create.status, 0, create.stderr);
  const id = proposalId(create.stdout);
  reviewProposal(targetRoot, id);
  const targetPath = join(targetRoot, 'docs', 'grounded-engineering.md');
  writeFileSync(targetPath, `${readFileSync(targetPath, 'utf8')}\nManual edit after review.\n`);
  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 2);
  assert.match(apply.stderr, /precondition/);
  assert.equal(existsSync(originalManifest), false);
  assert.match(readFileSync(targetPath, 'utf8'), /Manual edit after review/);
});

test('reports a clean baseline repository after apply', () => {
  const targetRoot = copyFixture('e2e-clean');
  const id = createReviewedProposal(targetRoot, '--profile', 'baseline');
  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 0, apply.stderr);

  const check = run(targetRoot, 'check');
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /Status: clean/);
});

test('reports a clean ai-assisted Claude repository after apply', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-claude-e2e-'));
  const id = createReviewedProposal(targetRoot, '--profile', 'ai-assisted', '--adapter', 'claude');
  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 0, apply.stderr);
  assert.equal(existsSync(join(targetRoot, 'CLAUDE.md')), true);

  const check = run(targetRoot, 'check');
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /Status: clean/);
});

test('keeps check clean when only unmanaged prose changes', () => {
  const targetRoot = copyFixture('e2e-clean');
  const id = createReviewedProposal(targetRoot, '--profile', 'baseline');
  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 0, apply.stderr);

  const targetPath = join(targetRoot, 'GROUNDED_ENGINEERING.md');
  const current = readFileSync(targetPath, 'utf8');
  writeFileSync(targetPath, `Repository-owned preface.\n\n${current}\nRepository-owned footer.\n`);

  const check = run(targetRoot, 'check');
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /Status: clean/);
});

test('reports a changed managed block as drift', () => {
  const targetRoot = copyFixture('e2e-clean');
  const id = createReviewedProposal(targetRoot, '--profile', 'baseline');
  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 0, apply.stderr);

  replaceFirstManagedBlock(join(targetRoot, 'GROUNDED_ENGINEERING.md'), 'Changed managed guidance for this test.');

  const check = run(targetRoot, 'check');
  assert.equal(check.status, 1);
  assert.match(check.stderr, /MANAGED_BLOCK_CHANGED/);
  assert.match(check.stderr, /GROUNDED_ENGINEERING\.md/);
});

test('reports a missing managed target as drift', () => {
  const targetRoot = copyFixture('e2e-clean');
  const id = createReviewedProposal(targetRoot, '--profile', 'baseline');
  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 0, apply.stderr);

  rmSync(join(targetRoot, 'GROUNDED_ENGINEERING.md'));

  const check = run(targetRoot, 'check');
  assert.equal(check.status, 1);
  assert.match(check.stderr, /MISSING_TARGET/);
  assert.match(check.stderr, /GROUNDED_ENGINEERING\.md/);
});

test('reports a missing manifest as drift', () => {
  const targetRoot = copyFixture('e2e-clean');
  const id = createReviewedProposal(targetRoot, '--profile', 'baseline');
  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 0, apply.stderr);

  rmSync(join(targetRoot, '.grounded-engineering', 'manifest.yaml'));

  const check = run(targetRoot, 'check');
  assert.equal(check.status, 1);
  assert.match(check.stderr, /MISSING_MANIFEST/);
});
