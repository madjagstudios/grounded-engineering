import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runDiscover, QUERIES } from '../scripts/discover-skill-repos.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const now = new Date('2026-10-06T00:00:00Z');
const item = (o) => ({ full_name: 'a/skills', default_branch: 'main', license: { spdx_id: 'MIT' }, pushed_at: '2026-09-30T00:00:00Z', stargazers_count: 10, archived: false, fork: false, ...o });

function fakeClient({ items, trees }) {
  return {
    searchRepositories: async () => ({ items }),
    listTreePaths: async (owner, repo) => trees[`${owner}/${repo}`] ?? { paths: [], truncated: false }
  };
}

test('reports licensed, active, SKILL.md-bearing repos and filters the rest', async () => {
  let out = '';
  const client = fakeClient({
    items: [
      item({ full_name: 'a/skills' }),
      item({ full_name: 'b/nolicense', license: null }),
      item({ full_name: 'c/stale', pushed_at: '2025-01-01T00:00:00Z' }),
      item({ full_name: 'd/noskill' }),
      item({ full_name: 'e/archived', archived: true })
    ],
    trees: { 'a/skills': { paths: ['x/SKILL.md'], truncated: false }, 'd/noskill': { paths: ['README.md'], truncated: false } }
  });
  const code = await runDiscover({ root, client, now, write: (s) => { out += s; } });
  assert.equal(code, 0);
  assert.match(out, /a\/skills/);
  for (const name of ['b/nolicense', 'c/stale', 'd/noskill', 'e/archived']) assert.ok(!out.includes(name), name);
  assert.match(out, /Report only/);
});

test('deduplicates repos returned by several queries', async () => {
  let out = '';
  const client = fakeClient({ items: [item()], trees: { 'a/skills': { paths: ['SKILL.md'], truncated: false } } });
  await runDiscover({ root, client, now, write: (s) => { out += s; } });
  assert.equal(out.match(/^a\/skills/gm).length, 1);
  assert.ok(QUERIES.length >= 2);
});
