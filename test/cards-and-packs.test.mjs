import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPracticeCards, resolveCardReference } from '../src/lib/cards.mjs';
import { loadPack } from '../src/lib/packs.mjs';

const root = new URL('../', import.meta.url).pathname;

test('resolves a canonical card ID and its filename slug to the same card', () => {
  const index = loadPracticeCards(root);
  const byId = resolveCardReference('GE-RC-001', index);
  const bySlug = resolveCardReference('inspect-repository-first', index);

  assert.equal(byId.id, 'GE-RC-001');
  assert.equal(bySlug.id, 'GE-RC-001');
  assert.equal(byId.slug, 'inspect-repository-first');
  assert.equal(byId.filePath, bySlug.filePath);
});

test('rejects unknown card references', () => {
  const index = loadPracticeCards(root);

  assert.throws(() => resolveCardReference('GE-RC-999', index), /Unknown practice card reference/);
  assert.throws(() => resolveCardReference('missing-practice', index), /Unknown practice card reference/);
});

test('loads the baseline pack with exactly the eight Context and Instructions cards', () => {
  const pack = loadPack(root, 'baseline');
  const ids = pack.cards.map((card) => card.id);

  assert.equal(pack.pack_id, 'baseline');
  assert.equal(pack.schema_version, '1.0.0');
  assert.equal(pack.grounded_engineering_release, 'v0.2.0');
  assert.deepEqual(ids, [
    'GE-RC-001',
    'GE-RC-002',
    'GE-CQ-001',
    'GE-CQ-002',
    'GE-TS-001',
    'GE-TS-002',
    'GE-VF-001',
    'GE-VF-002'
  ]);
});
