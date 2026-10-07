import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, serializeCatalog } from '../scripts/lib/catalog.mjs';
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

test('catalog never carries star counts or a status field', () => {
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

test('only listed skill repos are projected, with exactly the display fields', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ge-cat-'));
  try {
    for (const dir of ['research', 'practices', 'plugin']) cpSync(join(root, dir), join(tmp, dir), { recursive: true });
    cpSync(join(root, 'package.json'), join(tmp, 'package.json'));
    const dir = join(tmp, 'research', 'skill-repos');
    rmSync(dir, { recursive: true, force: true }); // only this test's records, not the real shelf
    mkdirSync(dir, { recursive: true });
    const base = {
      record_type: 'skill_repo', schema_version: '1.0.0', license: 'MIT', pinned_commit: 'c'.repeat(40),
      reviewed_on: '2026-10-06', best_for: ['AI_ASSISTED'], tags: ['planning'],
      summary: 'Planning and review skills for coding agents.', watch_out_for: 'Opinionated about session workflow.',
      install: '/plugin install example@example', status_reason: null
    };
    const records = [
      { ...base, id: 'GE-SR-001', name: 'listed-skills', repo: 'example/listed-skills', status: 'listed' },
      { ...base, id: 'GE-SR-002', name: 'delisted-skills', repo: 'example/delisted-skills', status: 'delisted', status_reason: 'Author asked to be removed.' },
      { ...base, id: 'GE-SR-003', name: 'pending-skills', repo: 'example/pending-skills', status: 'needs_review' }
    ];
    for (const r of records) {
      writeFileSync(join(dir, `${r.id}-${r.name}.yaml`), Object.entries(r).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n') + '\n');
    }
    const { skill_repos: listed } = buildCatalog(tmp);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, 'GE-SR-001');
    assert.deepEqual(Object.keys(listed[0]).sort(), ['best_for', 'id', 'install', 'license', 'name', 'pinned_commit', 'repo', 'reviewed_on', 'summary', 'tags', 'watch_out_for']);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('each practice carries its card body without the title heading', () => {
  const catalog = buildCatalog(root);
  for (const p of catalog.practices) {
    assert.equal(typeof p.body, 'string', p.id);
    assert.ok(p.body.length > 40, p.id);
    assert.ok(!p.body.startsWith('# '), p.id);
    assert.equal(p.body, p.body.trim(), p.id);
  }
});
