import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeManagedBlocks, parseManagedBlocks, renderManagedBlock } from '../src/lib/managed-blocks.mjs';
import { sha256Text, fingerprintTarget } from '../src/lib/fingerprints.mjs';

const card = { cardId: 'GE-RC-001', content: 'Before editing, inspect the repository.' };

test('renders and parses one card-keyed managed block', () => {
  const rendered = renderManagedBlock(card.cardId, card.content);
  const blocks = parseManagedBlocks(rendered);

  assert.match(rendered, /grounded-engineering:begin card=GE-RC-001/);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].cardId, 'GE-RC-001');
  assert.equal(blocks[0].normalizedContent, card.content);
});

test('appends new blocks without changing existing bytes', () => {
  const existing = 'Keep this paragraph.\n';
  const result = mergeManagedBlocks(existing, [card]);

  assert.equal(result.conflicts.length, 0);
  assert.equal(result.text.startsWith(existing), true);
  assert.equal(parseManagedBlocks(result.text)[0].cardId, 'GE-RC-001');
});

test('replaces only the existing matching block', () => {
  const existing = [
    '# Existing policy',
    '',
    'Keep this paragraph.',
    '',
    renderManagedBlock('GE-RC-001', 'Old guidance.'),
    '',
    'Keep this ending.'
  ].join('\n');
  const result = mergeManagedBlocks(existing, [card]);

  assert.equal(result.conflicts.length, 0);
  assert.match(result.text, /Keep this paragraph\./);
  assert.match(result.text, /Keep this ending\./);
  assert.match(result.text, /Before editing, inspect the repository\./);
  assert.doesNotMatch(result.text, /Old guidance\./);
});

test('rejects duplicate, missing, nested, and mismatched markers', () => {
  const malformed = [
    '<!-- grounded-engineering:begin card=GE-RC-001 -->',
    'one',
    '<!-- grounded-engineering:begin card=GE-RC-002 -->',
    'two',
    '<!-- grounded-engineering:end card=GE-RC-001 -->'
  ].join('\n');
  const duplicate = `${renderManagedBlock('GE-RC-001', 'one')}\n${renderManagedBlock('GE-RC-001', 'two')}`;
  const mismatched = `${renderManagedBlock('GE-RC-001', 'one').replace('end card=GE-RC-001', 'end card=GE-RC-002')}`;

  assert.throws(() => parseManagedBlocks(malformed), /nested managed block/);
  assert.throws(() => parseManagedBlocks(duplicate), /duplicate managed block/);
  assert.throws(() => parseManagedBlocks(mismatched), /does not match/);
  assert.throws(() => parseManagedBlocks('<!-- grounded-engineering:begin card=GE-RC-001 -->\nmissing end'), /missing end marker/);
});

test('fails closed for stale files and changed managed blocks', () => {
  const existing = renderManagedBlock('GE-RC-001', 'Original guidance.');
  const stale = mergeManagedBlocks(existing, [card], {
    expectedPreconditionSha256: sha256Text('different file')
  });
  const changedBlock = mergeManagedBlocks(existing, [card], {
    expectedBlockFingerprints: { 'GE-RC-001': sha256Text('different block') }
  });

  assert.equal(stale.text, existing);
  assert.equal(stale.conflicts[0].code, 'STALE_TARGET');
  assert.equal(changedBlock.text, existing);
  assert.equal(changedBlock.conflicts[0].code, 'MANAGED_BLOCK_CHANGED');
});

test('does not classify unmarked similar prose as a v1 conflict', () => {
  const result = mergeManagedBlocks('Before editing, inspect the repository.\n', [card]);

  assert.deepEqual(result.conflicts, []);
});
