import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildValidationEntries,
  renderValidationEntries,
  validationEntriesMatch
} from '../scripts/lib/validation-scaffold.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

test('builds entries in card source order from commit and doc pins', () => {
  const registry = new Map([
    ['CODEX-A', { kind: 'commit', immutableRefShas: [A, B], retrievalDate: null }],
    ['CLAUDE-D', { kind: 'doc', immutableRefShas: [], retrievalDate: '2026-08-26' }]
  ]);

  assert.deepEqual(buildValidationEntries({ source_ids: ['CLAUDE-D', 'CODEX-A'] }, registry), [
    { source_id: 'CLAUDE-D', revisions: ['2026-08-26'] },
    { source_id: 'CODEX-A', revisions: [A, B] }
  ]);
});

test('rejects a card source that is absent from the registry', () => {
  assert.throws(
    () => buildValidationEntries({ source_ids: ['CODEX-MISSING'] }, new Map()),
    /unknown source id CODEX-MISSING/
  );
});

test('compares source and revision sets without depending on entry order', () => {
  const expected = [
    { source_id: 'CODEX-A', revisions: [A, B] },
    { source_id: 'CLAUDE-D', revisions: ['2026-08-26'] }
  ];
  assert.equal(validationEntriesMatch([
    { source_id: 'CLAUDE-D', revisions: ['2026-08-26'] },
    { source_id: 'CODEX-A', revisions: [B, A] }
  ], expected), true);
  assert.equal(validationEntriesMatch([
    { source_id: 'CODEX-A', revisions: [A] },
    { source_id: 'CLAUDE-D', revisions: ['2026-08-26'] }
  ], expected), false);
});

test('renders a deterministic paste-ready validated_against block', () => {
  assert.equal(renderValidationEntries([
    { source_id: 'CODEX-A', revisions: [A, B] },
    { source_id: 'CLAUDE-D', revisions: ['2026-08-26'] }
  ]), `validated_against:
  - source_id: CODEX-A
    revisions:
      - ${A}
      - ${B}
  - source_id: CLAUDE-D
    revisions:
      - 2026-08-26
`);
});
