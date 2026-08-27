import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprintManagedBlocks, fingerprintTarget, sha256Text } from '../src/lib/fingerprints.mjs';
import { parseManagedBlocks } from '../src/lib/managed-blocks.mjs';

test('returns deterministic lowercase SHA-256 text fingerprints', () => {
  const fingerprint = sha256Text('Grounded Engineering');

  assert.equal(fingerprint, 'a87dc1538db2d51b9a9147c934298209dfa61485e05e950289938e010bca962d');
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
});

test('records absent preconditions and normalized managed-block fingerprints', () => {
  const result = fingerprintTarget('docs/grounded-engineering.md', null, [
    { cardId: 'GE-RC-001', content: 'Guidance.' }
  ]);

  assert.equal(result.path, 'docs/grounded-engineering.md');
  assert.equal(result.precondition_sha256, 'absent');
  assert.match(result.managed_block_sha256, /^[0-9a-f]{64}$/);
});

test('hashes marker-inclusive managed blocks in the supplied order and normalizes line endings', () => {
  const lfText = [
    '<!-- grounded-engineering:begin card=GE-RC-002 -->',
    'Second line one.',
    '',
    'Second line two.',
    '<!-- grounded-engineering:end card=GE-RC-002 -->',
    '',
    '<!-- grounded-engineering:begin card=GE-RC-001 -->',
    'First line one.',
    '',
    'First line two.',
    '<!-- grounded-engineering:end card=GE-RC-001 -->',
  ].join('\n');
  const crlfText = lfText.replace(/\n/g, '\r\n');
  const lfBlocks = parseManagedBlocks(lfText).map(({ cardId, normalizedContent }) => ({
    cardId,
    content: normalizedContent,
  }));
  const crlfBlocks = parseManagedBlocks(crlfText).map(({ cardId, normalizedContent }) => ({
    cardId,
    content: normalizedContent,
  }));
  const manifestOrder = ['GE-RC-001', 'GE-RC-002'];
  const byManifestOrder = (blocks) => manifestOrder.map((cardId) => blocks.find((block) => block.cardId === cardId));

  assert.equal(
    fingerprintManagedBlocks(byManifestOrder(lfBlocks)),
    fingerprintManagedBlocks(byManifestOrder(crlfBlocks))
  );
  assert.notEqual(
    fingerprintManagedBlocks(byManifestOrder(lfBlocks)),
    fingerprintManagedBlocks(lfBlocks)
  );
});
