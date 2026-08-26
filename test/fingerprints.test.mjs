import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprintTarget, sha256Text } from '../src/lib/fingerprints.mjs';

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
