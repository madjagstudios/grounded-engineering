import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSkillRepos } from '../src/lib/skill-repos.mjs';
import { runValidation } from '../scripts/validate.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const SHA = 'b'.repeat(40);

const record = (overrides = {}) => ({
  record_type: 'skill_repo', schema_version: '1.0.0', id: 'GE-SR-001', name: 'example-skills',
  repo: 'example/skills', license: 'MIT', pinned_commit: SHA, reviewed_on: '2026-10-06',
  status: 'listed', status_reason: null, best_for: ['AI_ASSISTED'], tags: ['planning'],
  summary: 'Planning and review skills for coding agents.', watch_out_for: 'Opinionated about session workflow.',
  install: '/plugin install example@example', ...overrides
});
const yaml = (r) => Object.entries(r).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n') + '\n';

function fixture(records) {
  const root = mkdtempSync(join(tmpdir(), 'ge-sr-'));
  cpSync(join(repoRoot, 'research'), join(root, 'research'), { recursive: true });
  const dir = join(root, 'research', 'skill-repos');
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(root, 'practices'), { recursive: true });
  for (const r of records) writeFileSync(join(dir, `${r.id}-${r.name}.yaml`), yaml(r));
  return root;
}

test('a missing skill-repos directory is not an error', () => {
  const root = mkdtempSync(join(tmpdir(), 'ge-sr-empty-'));
  assert.deepEqual(loadSkillRepos(root), { records: [], errors: [] });
});

test('a valid listed record loads', () => {
  const { records, errors } = loadSkillRepos(fixture([record()]));
  assert.deepEqual(errors, []);
  assert.equal(records.length, 1);
  assert.equal(records[0].repo, 'example/skills');
});

test('listed rejects licenses that are not canonical SPDX expressions', () => {
  for (const license of ['NOASSERTION', 'NONE', 'Other', 'unknown', 'not a license', 'MIT OR', 'FooBar-9', 'mit',
    'MIT OR FooBar-9', 'MIT WITH Not-An-Exception', ' MIT', 'MIT or Apache-2.0']) {
    const { errors } = loadSkillRepos(fixture([record({ license })]));
    assert.ok(errors.some((e) => /not a valid SPDX license expression/.test(e)), `${JSON.stringify(license)}: ${errors.join('\n')}`);
  }
});

test('records that are not listed are not license-checked', () => {
  for (const status of ['needs_review', 'delisted']) {
    const { errors } = loadSkillRepos(fixture([record({ status, status_reason: 'Waiting on a license from the author.', license: 'FooBar-9' })]));
    assert.deepEqual(errors, [], status);
  }
});

test('listed accepts valid SPDX expressions', () => {
  for (const license of ['Apache-2.0', 'MIT OR Apache-2.0', '(MIT OR Apache-2.0)', 'LicenseRef-Custom',
    'GPL-2.0-or-later WITH Classpath-exception-2.0', 'LGPL-3.0+', '(MIT AND BSD-3-Clause) OR Apache-2.0']) {
    const { errors } = loadSkillRepos(fixture([record({ license })]));
    assert.deepEqual(errors, [], license);
  }
});

test('delisted requires a status_reason', () => {
  const { errors } = loadSkillRepos(fixture([record({ status: 'delisted', status_reason: null })]));
  assert.ok(errors.some((e) => /status_reason/.test(e)), errors.join('\n'));
});

test('duplicate ids and duplicate repos are rejected', () => {
  const { errors } = loadSkillRepos(fixture([record(), record({ name: 'other', repo: 'Example/Skills' })]));
  assert.ok(errors.some((e) => /duplicate id GE-SR-001/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /duplicate repo example\/skills/i.test(e)), errors.join('\n'));
});

test('file name must start with the record id', () => {
  const root = fixture([]);
  writeFileSync(join(root, 'research', 'skill-repos', 'wrong-name.yaml'), yaml(record()));
  const { errors } = loadSkillRepos(root);
  assert.ok(errors.some((e) => /file name must start with GE-SR-001-/.test(e)), errors.join('\n'));
});

test('unknown tags are rejected', () => {
  const { errors } = loadSkillRepos(fixture([record({ tags: ['vibes'] })]));
  assert.ok(errors.some((e) => /tags/.test(e)), errors.join('\n'));
});

test('runValidation surfaces skill-repo errors', () => {
  const { errors } = runValidation({ root: fixture([record({ license: '' })]) });
  assert.ok(errors.some((e) => /research\/skill-repos\/GE-SR-001-example-skills\.yaml/.test(e)), errors.join('\n'));
});
