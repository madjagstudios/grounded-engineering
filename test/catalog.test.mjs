import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildCatalog, serializeCatalog } from '../src/lib/catalog.mjs';
import { loadPracticeCards } from '../src/lib/cards.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('two builds serialize byte-identically', () => {
  assert.equal(serializeCatalog(buildCatalog(root)), serializeCatalog(buildCatalog(root)));
});

test('serialization sorts keys and ends with a newline', () => {
  const text = serializeCatalog({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } });
  assert.equal(text, '{\n  "a": {\n    "c": [\n      3,\n      {\n        "e": 5,\n        "f": 4\n      }\n    ],\n    "d": 2\n  },\n  "b": 1\n}\n');
});

test('catalog carries every card, sorted, with repo-relative posix paths', () => {
  const catalog = buildCatalog(root);
  assert.equal(catalog.catalog_version, 1);
  assert.equal(catalog.practices.length, loadPracticeCards(root).cards.length);
  const ids = catalog.practices.map((p) => p.id);
  assert.deepEqual(ids, [...ids].sort());
  for (const p of catalog.practices) {
    assert.match(p.path, /^practices\/[a-z-]+\/[a-z0-9-]+\.md$/);
    assert.ok(['validated', 'not_validated', 'needs_review'].includes(p.validation_status), p.id);
  }
  assert.deepEqual(catalog.categories, [...new Set(catalog.practices.map((p) => p.category))].sort());
});

test('catalog never carries star counts or delisted repos', () => {
  const text = serializeCatalog(buildCatalog(root));
  assert.ok(!/stargazers|"stars"/.test(text));
  for (const r of buildCatalog(root).skill_repos) assert.ok(!('status' in r));
});

test('signals and fit rules are included', () => {
  const catalog = buildCatalog(root);
  assert.ok(catalog.signals.some((s) => s.name === 'has_ci' && s.type === 'boolean'));
  assert.ok(catalog.fit_rules.length >= 6);
});

test('signals carry name, type, and description', () => {
  for (const s of buildCatalog(root).signals) {
    assert.deepEqual(Object.keys(s).sort(), ['description', 'name', 'type']);
    assert.ok(s.description.length > 0, s.name);
  }
});

test('every practice source id resolves to an https URL in sources', () => {
  const catalog = buildCatalog(root);
  const ids = catalog.sources.map((s) => s.id);
  assert.deepEqual(ids, [...ids].sort());
  assert.equal(new Set(ids).size, ids.length);
  const urls = new Map(catalog.sources.map((s) => [s.id, s.url]));
  const referenced = new Set(catalog.practices.flatMap((p) => p.source_ids));
  assert.deepEqual([...referenced].sort(), ids);
  for (const id of referenced) assert.match(urls.get(id) ?? '', /^https:\/\//, id);
  for (const s of catalog.sources) assert.deepEqual(Object.keys(s).sort(), ['id', 'url']);
});
