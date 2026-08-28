import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCardValidationProvenance } from '../scripts/lib/source-registry.mjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
const registry = new Map([
  ['CODEX-M', { kind: 'commit', immutableRefShas: [A, B], retrievalDate: null }],
  ['CODEX-S', { kind: 'commit', immutableRefShas: [A], retrievalDate: null }],
  ['CLAUDE-D', { kind: 'doc', immutableRefShas: [], retrievalDate: '2026-08-26' }]
]);
const card = (validation, source_ids, filePath = 'c.md') => ({ record: { source_ids, validation }, filePath });
const msgs = (cards) => validateCardValidationProvenance(cards, registry).map((d) => d.message);

test('validated: matching revision sets (multi-SHA + doc) → clean', () => {
  const d = validateCardValidationProvenance([card(
    { status: 'validated', validated_against: [{ source_id: 'CODEX-M', revisions: [B, A] }, { source_id: 'CLAUDE-D', revisions: ['2026-08-26'] }] },
    ['CODEX-M', 'CLAUDE-D']
  )], registry);
  assert.deepEqual(d, []);
});

test('validated: repin [A,B]→[A,C] with card still recording [A,B] → error', () => {
  const reg2 = new Map(registry);
  reg2.set('CODEX-M', { kind: 'commit', immutableRefShas: [A, C], retrievalDate: null });
  const d = validateCardValidationProvenance([card(
    { status: 'validated', validated_against: [{ source_id: 'CODEX-M', revisions: [A, B] }] }, ['CODEX-M']
  )], reg2);
  assert.ok(d.some((x) => x.sourceId === 'CODEX-M'
    && x.message.includes(`recorded revisions [${A}, ${B}]`)   // sorted got
    && x.message.includes(`current pin [${A}, ${C}]`)));       // sorted want
});

test('validated: recording a subset [A] of a [A,B] source → error', () => {
  assert.ok(msgs([card({ status: 'validated', validated_against: [{ source_id: 'CODEX-M', revisions: [A] }] }, ['CODEX-M'])]).some((m) => /do not equal current pin/i.test(m)));
});

test('validated: missing / extra / duplicate source entries → errors', () => {
  assert.ok(msgs([card({ status: 'validated', validated_against: [{ source_id: 'CODEX-S', revisions: [A] }] }, ['CODEX-S', 'CLAUDE-D'])]).some((m) => /missing entry for CLAUDE-D/i.test(m)));
  assert.ok(msgs([card({ status: 'validated', validated_against: [{ source_id: 'CODEX-S', revisions: [A] }, { source_id: 'CODEX-M', revisions: [A, B] }] }, ['CODEX-S'])]).some((m) => /not in source_ids/i.test(m)));
  assert.ok(msgs([card({ status: 'validated', validated_against: [{ source_id: 'CODEX-S', revisions: [A] }, { source_id: 'CODEX-S', revisions: [A] }] }, ['CODEX-S'])]).some((m) => /duplicate/i.test(m)));
});

test('validated: a date for a commit source (kind mismatch) → error', () => {
  assert.ok(msgs([card({ status: 'validated', validated_against: [{ source_id: 'CODEX-S', revisions: ['2026-08-26'] }] }, ['CODEX-S'])]).some((m) => /do not equal current pin/i.test(m)));
});

test('needs_review: mismatched but well-formed revisions (incl. SHA for a now-doc source) → clean', () => {
  const reg2 = new Map(registry);
  reg2.set('CODEX-S', { kind: 'doc', immutableRefShas: [], retrievalDate: '2026-08-26' }); // changed kind
  const d = validateCardValidationProvenance([card(
    { status: 'needs_review', note: 'source changed', validated_against: [{ source_id: 'CODEX-S', revisions: [A] }] }, ['CODEX-S']
  )], reg2);
  assert.deepEqual(d, []);
});

test('needs_review: an impossible-date revision → error', () => {
  assert.ok(msgs([card({ status: 'needs_review', note: 'source date is invalid', validated_against: [{ source_id: 'CLAUDE-D', revisions: ['2026-02-31'] }] }, ['CLAUDE-D'])]).some((m) => /not a SHA or valid calendar date/i.test(m)));
});

test('not_validated carrying validated_against → error', () => {
  assert.ok(msgs([card({ status: 'not_validated', validated_against: [{ source_id: 'CODEX-S', revisions: [A] }] }, ['CODEX-S'])]).some((m) => /must not carry/i.test(m)));
});

test('validated: an entry for a source absent from the registry → error', () => {
  const d = validateCardValidationProvenance([card({ status: 'validated', validated_against: [{ source_id: 'CODEX-X', revisions: [A] }] }, ['CODEX-X'])], registry);
  assert.ok(d.some((x) => x.sourceId === 'CODEX-X' && /unknown source CODEX-X/i.test(x.message)));
});

test('two stale sources → two source-named diagnostics; deterministic under reverse input', () => {
  const reg2 = new Map(registry);
  reg2.set('CODEX-S', { kind: 'commit', immutableRefShas: [C], retrievalDate: null });
  const va = [{ source_id: 'CODEX-S', revisions: [A] }, { source_id: 'CLAUDE-D', revisions: ['2020-01-01'] }];
  const d1 = validateCardValidationProvenance([card({ status: 'validated', validated_against: va }, ['CODEX-S', 'CLAUDE-D'])], reg2);
  const d2 = validateCardValidationProvenance([card({ status: 'validated', validated_against: [...va].reverse() }, ['CODEX-S', 'CLAUDE-D'])], reg2);
  assert.equal(d1.length, 2);
  assert.ok(d1.every((x) => /CODEX-S|CLAUDE-D/.test(x.message)));
  // exact recorded-vs-expected payload per source (spec #7)
  assert.ok(d1.some((x) => x.sourceId === 'CODEX-S' && x.message.includes(`recorded revisions [${A}]`) && x.message.includes(`current pin [${C}]`)));
  assert.ok(d1.some((x) => x.sourceId === 'CLAUDE-D' && x.message.includes('recorded revisions [2020-01-01]') && x.message.includes('current pin [2026-08-26]')));
  assert.deepEqual(d1.map((x) => x.message), d2.map((x) => x.message)); // order-independent
});
