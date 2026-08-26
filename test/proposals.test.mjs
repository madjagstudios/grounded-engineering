import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createProposal, createProposalId, loadProposal, renderProposalDiff } from '../src/lib/proposals.mjs';

const sourceRoot = new URL('../', import.meta.url).pathname;

test('creates deterministic proposal IDs from UTC time and random bytes', () => {
  const id = createProposalId(new Date('2026-08-26T14:30:00.000Z'), Buffer.from([0xa1, 0xb2, 0xc3, 0xd4]));

  assert.equal(id, '20260826-143000-a1b2c3d4');
});

test('creates and loads a saved proposal without changing canonical target files', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-proposal-'));
  const proposal = createProposal(targetRoot, {
    sourceRoot,
    packId: 'baseline',
    now: new Date('2026-08-26T14:30:00.000Z'),
    randomBytes: Buffer.from([0xa1, 0xb2, 0xc3, 0xd4])
  });

  assert.equal(proposal.proposal_id, '20260826-143000-a1b2c3d4');
  assert.equal(existsSync(join(targetRoot, 'GROUNDED_ENGINEERING.md')), false);
  assert.equal(existsSync(join(targetRoot, '.grounded-engineering', 'proposals', proposal.proposal_id, 'proposal.yaml')), true);
  assert.equal(existsSync(join(targetRoot, '.grounded-engineering', 'proposals', proposal.proposal_id, 'plan.md')), true);
  assert.equal(existsSync(join(targetRoot, '.grounded-engineering', 'proposals', proposal.proposal_id, 'diff.patch')), true);
  assert.equal(existsSync(join(targetRoot, '.grounded-engineering', 'proposals', proposal.proposal_id, 'validation.json')), true);

  const loaded = loadProposal(targetRoot, proposal.proposal_id);
  assert.equal(loaded.pack_id, 'baseline');
  assert.deepEqual(loaded.cards.map((card) => card.id), [
    'GE-RC-001', 'GE-RC-002', 'GE-CQ-001', 'GE-CQ-002',
    'GE-TS-001', 'GE-TS-002', 'GE-VF-001', 'GE-VF-002'
  ]);
  assert.match(readFileSync(join(targetRoot, '.grounded-engineering', 'proposals', proposal.proposal_id, 'plan.md'), 'utf8'), /CODEX-AGENTS-GUIDE/);
});

test('renders a stable file-by-file proposal diff without timestamps', () => {
  const diff = renderProposalDiff([
    { path: 'docs/grounded-engineering.md', content: 'Generated guidance.\n' }
  ]);

  assert.match(diff, /^--- \/dev\/null$/m);
  assert.match(diff, /^\+\+\+ b\/docs\/grounded-engineering\.md/m);
  assert.match(diff, /^\+Generated guidance\.$/m);
  assert.doesNotMatch(diff, /2026-08-26/);
});

test('renders an existing-file merge as a true patch', () => {
  const diff = renderProposalDiff([{
    path: 'docs/grounded-engineering.md',
    before_content: '# Existing policy\n\nKeep this paragraph.\n',
    content: '# Existing policy\n\nKeep this paragraph.\n\nGenerated guidance.\n'
  }]);

  assert.match(diff, /^--- a\/docs\/grounded-engineering\.md$/m);
  assert.match(diff, /^ # Existing policy$/m);
  assert.match(diff, /^\+Generated guidance\.$/m);
  assert.doesNotMatch(diff, /^\+# Existing policy$/m);
  assert.doesNotMatch(diff, /@@ -0,0/);
});
