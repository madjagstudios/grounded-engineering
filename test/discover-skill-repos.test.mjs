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

async function run(client) {
  let out = '';
  const code = await runDiscover({ root, client, now, write: (s) => { out += s; } });
  return { code, out };
}

test('excludes forks', async () => {
  const { out } = await run(fakeClient({
    items: [item({ full_name: 'f/forked', fork: true }), item({ full_name: 'a/skills' })],
    trees: { 'f/forked': { paths: ['SKILL.md'], truncated: false }, 'a/skills': { paths: ['SKILL.md'], truncated: false } }
  }));
  assert.ok(!out.includes('f/forked'));
  assert.match(out, /a\/skills/);
});

test('excludes NOASSERTION and NONE licenses', async () => {
  const tree = { paths: ['SKILL.md'], truncated: false };
  const { out } = await run(fakeClient({
    items: [
      item({ full_name: 'l/noassertion', license: { spdx_id: 'NOASSERTION' } }),
      item({ full_name: 'l/none', license: { spdx_id: 'NONE' } }),
      item({ full_name: 'l/ok' })
    ],
    trees: { 'l/noassertion': tree, 'l/none': tree, 'l/ok': tree }
  }));
  assert.ok(!out.includes('l/noassertion'));
  assert.ok(!out.includes('l/none'));
  assert.match(out, /l\/ok/);
});

test('keeps a truncated tree with a visible SKILL.md and marks the count as a lower bound', async () => {
  const { code, out } = await run(fakeClient({
    items: [item({ full_name: 't/big' })],
    trees: { 't/big': { paths: ['a/SKILL.md', 'b/SKILL.md', 'README.md'], truncated: true } }
  }));
  assert.equal(code, 0);
  assert.match(out, /^t\/big\tMIT\t>=2 SKILL\.md \(tree truncated\)\t/m);
});

test('keeps a truncated tree with no visible SKILL.md as unverified', async () => {
  const { code, out } = await run(fakeClient({
    items: [item({ full_name: 't/huge' })],
    trees: { 't/huge': { paths: ['README.md'], truncated: true } }
  }));
  assert.equal(code, 0);
  assert.match(out, /^t\/huge\tMIT\tSKILL\.md unverified \(tree truncated\)\t/m);
});

test('reports no Skipped line when every lookup succeeds', async () => {
  const { out } = await run(fakeClient({ items: [item()], trees: { 'a/skills': { paths: ['SKILL.md'], truncated: false } } }));
  assert.ok(!out.includes('Skipped:'));
});

test('summarises failed searches and unreadable trees and still exits 0', async () => {
  let calls = 0;
  const client = {
    searchRepositories: async () => (calls++ === 0 ? { error: 'search_http_503' } : { items: [item({ full_name: 'a/skills' }), item({ full_name: 'e/broken' })] }),
    listTreePaths: async (owner, repo) => (repo === 'broken' ? { error: 'tree_http_500' } : { paths: ['SKILL.md'], truncated: false })
  };
  const { code, out } = await run(client);
  assert.equal(code, 0);
  assert.match(out, /^a\/skills\t/m);
  assert.ok(!/^e\/broken\t/m.test(out));
  assert.match(out, /^Skipped: 1 search\(es\) failed, 1 repo tree\(s\) could not be read\.$/m);
});

test('orders by stars descending, then by name for equal stars', async () => {
  const tree = { paths: ['SKILL.md'], truncated: false };
  const { out } = await run(fakeClient({
    items: [
      item({ full_name: 'z/low', stargazers_count: 5 }),
      item({ full_name: 'b/tie', stargazers_count: 20 }),
      item({ full_name: 'a/tie', stargazers_count: 20 }),
      item({ full_name: 'm/top', stargazers_count: 99 })
    ],
    trees: { 'z/low': tree, 'b/tie': tree, 'a/tie': tree, 'm/top': tree }
  }));
  const order = out.split('\n').filter((l) => l.includes('\tMIT\t')).map((l) => l.split('\t')[0]);
  assert.deepEqual(order, ['m/top', 'a/tie', 'b/tie', 'z/low']);
});
