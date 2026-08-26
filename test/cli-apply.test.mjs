import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import test from 'node:test';
import { applyProposal, collectLocalDecisions, createProposal, loadProposal } from '../src/lib/proposals.mjs';
import { buildManifest, validateManifest } from '../src/lib/manifest.mjs';
import { sha256Text } from '../src/lib/fingerprints.mjs';

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

function createReviewedProposal(targetRoot) {
  const proposal = createProposal(targetRoot, {
    sourceRoot: root,
    packId: 'baseline',
    proposalId: '20260826-143000-a1b2c3d4',
  });
  return { proposal, decisions: reviewedDecisions(proposal) };
}

test('collects local decisions without treating public disposition as approval', () => {
  const cards = [{ id: 'GE-RC-001' }, { id: 'GE-RC-002' }];
  assert.throws(
    () => collectLocalDecisions(cards, [{ id: 'GE-RC-001', local_applicability: 'APPLICABLE' }, { id: 'GE-RC-002', local_applicability: 'NEEDS_REVIEW' }]),
    /local_decision is required/
  );

  assert.deepEqual(
    collectLocalDecisions(cards, [
      { id: 'GE-RC-001', local_applicability: 'APPLICABLE', local_decision: 'ACCEPT' },
      { id: 'GE-RC-002', local_applicability: 'NOT_APPLICABLE' },
    ]),
    [
      { id: 'GE-RC-001', local_applicability: 'APPLICABLE', local_decision: 'ACCEPT' },
      { id: 'GE-RC-002', local_applicability: 'NOT_APPLICABLE' },
    ]
  );

  assert.throws(
    () => collectLocalDecisions(cards, [{ id: 'GE-RC-001', local_applicability: 'APPLICABLE', local_decision: 'DEFER' }]),
    /revisit_trigger is required/
  );
  assert.throws(
    () => collectLocalDecisions(cards, [{ id: 'GE-RC-001', local_applicability: 'NOT_APPLICABLE', local_decision: 'DECLINE' }]),
    /must not include local_decision/
  );
});

test('applies a reviewed proposal to a new target and writes a valid manifest', () => {
  const targetRoot = copyFixture('apply-clean');
  const { proposal, decisions } = createReviewedProposal(targetRoot);
  const result = applyProposal(targetRoot, proposal.proposal_id, { sourceRoot: root, confirm: true, decisions });

  assert.deepEqual(result.committedPaths, ['GROUNDED_ENGINEERING.md', '.grounded-engineering/manifest.yaml']);
  assert.equal(existsSync(join(targetRoot, 'GROUNDED_ENGINEERING.md')), true);
  const manifestPath = join(targetRoot, '.grounded-engineering', 'manifest.yaml');
  const manifestText = readFileSync(manifestPath, 'utf8');
  assert.doesNotMatch(manifestText, /created_at|updated_at|timestamp/);
  const manifest = parse(manifestText);
  const validation = validateManifest(manifest, root);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(manifest.grounded_engineering_release, 'v0.2.0');
  assert.equal(manifest.pack_id, 'baseline');
  assert.equal(manifest.schema_version, '1.0.0');
  assert.equal(manifest.cards[0].public_disposition, 'ADOPT');
  assert.equal(manifest.cards[0].local_applicability, 'APPLICABLE');
  assert.equal(manifest.cards[0].local_decision, 'ACCEPT');
  assert.ok(manifest.cards[0].source_refs.length > 0);
  assert.match(manifest.targets[0].managed_block_sha256, /^[0-9a-f]{64}$/);
});

test('preserves bytes outside managed blocks in an existing target', () => {
  const targetRoot = copyFixture('apply-existing');
  const targetPath = join(targetRoot, 'docs', 'grounded-engineering.md');
  const before = readFileSync(targetPath, 'utf8');
  const { proposal, decisions } = createReviewedProposal(targetRoot);
  applyProposal(targetRoot, proposal.proposal_id, { sourceRoot: root, confirm: true, decisions });
  const after = readFileSync(targetPath, 'utf8');

  assert.match(after, /This paragraph is owned by the repository and must remain byte-for-byte unchanged/);
  assert.match(after, /Keep this footer unchanged too/);
  assert.notEqual(after, before);
});

test('rejects a changed full-file precondition before any write', () => {
  const targetRoot = copyFixture('apply-dirty');
  const targetPath = join(targetRoot, 'docs', 'grounded-engineering.md');
  const beforeProposal = readFileSync(targetPath, 'utf8');
  const { proposal, decisions } = createReviewedProposal(targetRoot);
  writeFileSync(targetPath, `${beforeProposal}\nChanged after proposal creation.\n`);
  assert.throws(
    () => applyProposal(targetRoot, proposal.proposal_id, { sourceRoot: root, confirm: true, decisions }),
    /precondition/
  );
  assert.equal(readFileSync(targetPath, 'utf8'), `${beforeProposal}\nChanged after proposal creation.\n`);
  assert.equal(existsSync(join(targetRoot, '.grounded-engineering', 'manifest.yaml')), false);
});

test('rejects malformed managed markers before any write', () => {
  const targetRoot = copyFixture('apply-existing');
  const targetPath = join(targetRoot, 'docs', 'grounded-engineering.md');
  const before = readFileSync(targetPath, 'utf8');
  const { proposal, decisions } = createReviewedProposal(targetRoot);
  const malformed = `${before}\n<!-- grounded-engineering:begin card=GE-RC-001 -->\n`;
  writeFileSync(targetPath, malformed);
  const proposalPath = join(targetRoot, '.grounded-engineering', 'proposals', proposal.proposal_id, 'proposal.yaml');
  const editedProposal = parse(readFileSync(proposalPath, 'utf8'));
  editedProposal.targets[0].precondition_sha256 = sha256Text(malformed);
  writeFileSync(proposalPath, stringify(editedProposal));
  assert.throws(
    () => applyProposal(targetRoot, proposal.proposal_id, { sourceRoot: root, confirm: true, decisions }),
    /duplicate managed block/
  );
  assert.equal(existsSync(join(targetRoot, '.grounded-engineering', 'manifest.yaml')), false);
});

test('builds a manifest with the required local outcome fields', () => {
  const manifest = buildManifest({
    schema_version: '1.0.0',
    grounded_engineering_release: 'v0.2.0',
    pack_id: 'baseline',
    pack_version: '1.0.0',
    cards: [{
      id: 'GE-RC-001',
      public_disposition: 'ADAPT',
      local_applicability: 'APPLICABLE',
      local_decision: 'ADAPT',
      source_refs: ['SRC-001'],
    }],
    targets: [{
      path: 'docs/grounded-engineering.md',
      kind: 'provider-neutral-markdown',
      precondition_sha256: 'absent',
      managed_block_sha256: 'a'.repeat(64),
    }],
    validation: { status: 'validated' },
  });
  assert.equal(validateManifest(manifest, root).valid, true);
});
