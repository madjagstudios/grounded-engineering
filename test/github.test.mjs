import assert from 'node:assert/strict';
import test from 'node:test';
import { createGithubClient } from '../scripts/lib/github.mjs';

const SHA = 'a'.repeat(40);
const res = ({ status = 200, json = undefined, headers = {} }) => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: (k) => headers[String(k).toLowerCase()] ?? null },
  json: async () => { if (json === undefined) throw new Error('no json'); return json; }
});
const scripted = (steps) => { let i = 0; const f = async (url, opts) => { f.calls.push({ url, opts }); const s = steps[i++]; if (!s) throw new Error(`no scripted step ${i - 1}`); if (s.throw) throw new Error(s.throw); return s.res; }; f.calls = []; return f; };
const okHeaders = { 'x-ratelimit-remaining': '59' };

test('resolveHead: repos → default_branch, then list-commits[0].sha; headers + token', async () => {
  const f = scripted([
    { res: res({ json: { default_branch: 'main' }, headers: okHeaders }) },
    { res: res({ json: [{ sha: SHA }], headers: okHeaders }) }
  ]);
  const c = createGithubClient({ fetchImpl: f, token: 'tok' });
  assert.deepEqual(await c.resolveHead('o', 'r'), { branch: 'main', sha: SHA });
  assert.equal(f.calls[0].opts.headers['User-Agent'], 'grounded-engineering');
  assert.equal(f.calls[0].opts.headers.Authorization, 'Bearer tok');
  assert.equal(f.calls[0].opts.headers['X-GitHub-Api-Version'], '2022-11-28');
  assert.match(f.calls[1].url, /\/commits\?sha=main&per_page=1/);
  assert.equal(c.callCount(), 2);
});

test('resolveHead: branch with slash is query-encoded', async () => {
  const f = scripted([{ res: res({ json: { default_branch: 'release/v2' }, headers: okHeaders }) }, { res: res({ json: [{ sha: SHA }], headers: okHeaders }) }]);
  await createGithubClient({ fetchImpl: f }).resolveHead('o', 'r');
  assert.match(f.calls[1].url, /\/commits\?sha=release%2Fv2&per_page=1/);
});

test('resolveHead: non-2xx repo/commit, missing default_branch, bad/empty head sha → error (no eager parse)', async () => {
  const f404 = scripted([{ res: res({ status: 404, json: { default_branch: 'main' } }) }]);
  const err404 = createGithubClient({ fetchImpl: f404 });
  assert.ok((await err404.resolveHead('o', 'r')).error);
  assert.equal(f404.calls.length, 1); // proves it did NOT make the commits request
  const noBranch = createGithubClient({ fetchImpl: scripted([{ res: res({ json: {}, headers: okHeaders }) }]) });
  assert.ok((await noBranch.resolveHead('o', 'r')).error);
  const bad500 = createGithubClient({ fetchImpl: scripted([{ res: res({ json: { default_branch: 'main' }, headers: okHeaders }) }, { res: res({ status: 500 }) }]) });
  assert.ok((await bad500.resolveHead('o', 'r')).error);
  const badSha = createGithubClient({ fetchImpl: scripted([{ res: res({ json: { default_branch: 'main' }, headers: okHeaders }) }, { res: res({ json: [{ sha: 'nope' }], headers: okHeaders }) }]) });
  assert.ok((await badSha.resolveHead('o', 'r')).error);
  const emptyCommits = createGithubClient({ fetchImpl: scripted([{ res: res({ json: { default_branch: 'main' }, headers: okHeaders }) }, { res: res({ json: [], headers: okHeaders }) }]) });
  assert.ok((await emptyCommits.resolveHead('o', 'r')).error);
});

test('getObject classifies file/dir/symlink/submodule/absent/bad-sha/5xx/non-json', async () => {
  const mk = (opts) => createGithubClient({ fetchImpl: scripted([{ res: res(opts) }]) });
  assert.deepEqual(await mk({ json: { type: 'file', sha: SHA }, headers: okHeaders }).getObject('o', 'r', SHA, 'a.rs'), { kind: 'blob', sha: SHA });
  assert.equal((await mk({ json: [{ name: 'x' }], headers: okHeaders }).getObject('o', 'r', SHA, 'd')).kind, 'dir');
  assert.equal((await mk({ json: { type: 'symlink', target: 'x' }, headers: okHeaders }).getObject('o', 'r', SHA, 'l')).kind, 'symlink');
  assert.equal((await mk({ json: { submodule_git_url: 'git://x' }, headers: okHeaders }).getObject('o', 'r', SHA, 's')).kind, 'submodule');
  assert.equal((await mk({ status: 404 }).getObject('o', 'r', SHA, 'x')).kind, 'absent');
  assert.equal((await mk({ json: { type: 'file', sha: 'nothex' }, headers: okHeaders }).getObject('o', 'r', SHA, 'x')).kind, 'error');
  assert.equal((await mk({ status: 500 }).getObject('o', 'r', SHA, 'x')).kind, 'error');
  assert.equal((await mk({ status: 200 }).getObject('o', 'r', SHA, 'x')).kind, 'error'); // 200 but .json() throws
});

test('getObject: path segments and ref URL-encoded (space/unicode/?/#)', async () => {
  const f = scripted([{ res: res({ json: { type: 'file', sha: SHA }, headers: okHeaders }) }]);
  await createGithubClient({ fetchImpl: f }).getObject('o', 'r', 'main', 'dir/a b?#é.rs');
  assert.match(f.calls[0].url, /contents\/dir\/a%20b%3F%23%C3%A9\.rs\?ref=main/);
});

test('token: omitted → no auth; empty → no auth; null → env fallback', async () => {
  const cap = async (opts, env) => { const f = scripted([{ res: res({ json: { type: 'file', sha: SHA }, headers: okHeaders }) }]); const old = process.env.GITHUB_TOKEN; if (env === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = env; await createGithubClient({ fetchImpl: f, ...opts }).getObject('o', 'r', SHA, 'a'); if (old === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = old; return f.calls[0].opts.headers.Authorization; };
  assert.equal(await cap({}, undefined), undefined);
  assert.equal(await cap({ token: '' }, 'envtok'), undefined);      // empty string ⇒ no auth
  assert.equal(await cap({ token: null }, 'envtok'), 'Bearer envtok'); // null ⇒ env fallback
});

test('rate-limit persists across calls (resolveHead→getObject); 429/Retry-After; remaining:0 without reset fails closed', async () => {
  const reset = String(Math.floor(Date.now() / 1000) + 3600);
  const c1 = createGithubClient({ fetchImpl: scripted([{ res: res({ json: { default_branch: 'main' }, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset } }) }]) });
  await c1.resolveHead('o', 'r');
  const o1 = await c1.getObject('o', 'r', SHA, 'a.rs');
  assert.equal(o1.kind, 'error'); assert.match(o1.reason, /rate_limited/); assert.equal(c1.callCount(), 1);
  const c2 = createGithubClient({ fetchImpl: scripted([{ res: res({ status: 429, headers: { 'retry-after': '60' } }) }]) });
  assert.match((await c2.getObject('o', 'r', SHA, 'a')).reason, /rate_limited/);
  const c3 = createGithubClient({ fetchImpl: scripted([{ res: res({ json: { type: 'file', sha: SHA }, headers: { 'x-ratelimit-remaining': '0' } }) }]) }); // no reset header
  await c3.getObject('o', 'r', SHA, 'a'); // records remaining:0, no reset
  assert.match((await c3.getObject('o', 'r', SHA, 'b')).reason, /rate_limited.*unknown/); // fail closed
});

test('rejected fetch → error; null result → malformed; never-settling fetch → timeout', async () => {
  assert.match((await createGithubClient({ fetchImpl: async () => { throw new Error('network'); } }).getObject('o', 'r', SHA, 'a')).reason, /fetch_failed/);
  assert.match((await createGithubClient({ fetchImpl: async () => null }).getObject('o', 'r', SHA, 'a')).reason, /malformed_response/);
  assert.match((await createGithubClient({ fetchImpl: () => new Promise(() => {}), timeoutMs: 20 }).getObject('o', 'r', SHA, 'a')).reason, /timeout/);
});

test('searchRepositories: encodes the query and returns items', async () => {
  const f = scripted([{ res: res({ json: { items: [{ full_name: 'o/r' }] }, headers: okHeaders }) }]);
  const out = await createGithubClient({ fetchImpl: f }).searchRepositories('topic:claude-skills fork:false');
  assert.deepEqual(out, { items: [{ full_name: 'o/r' }] });
  assert.match(f.calls[0].url, /\/search\/repositories\?q=topic%3Aclaude-skills%20fork%3Afalse&sort=stars&order=desc&per_page=50$/);
});

test('listTreePaths: returns blob paths and the truncated flag', async () => {
  const f = scripted([{ res: res({ json: { truncated: false, tree: [{ path: 'a/SKILL.md', type: 'blob' }, { path: 'a', type: 'tree' }] }, headers: okHeaders }) }]);
  const out = await createGithubClient({ fetchImpl: f }).listTreePaths('o', 'r', 'main');
  assert.deepEqual(out, { paths: ['a/SKILL.md'], truncated: false });
  assert.match(f.calls[0].url, /\/repos\/o\/r\/git\/trees\/main\?recursive=1$/);
});

test('searchRepositories: http errors become { error }', async () => {
  const f = scripted([{ res: res({ status: 422, headers: okHeaders }) }]);
  assert.deepEqual(await createGithubClient({ fetchImpl: f }).searchRepositories('x'), { error: 'search_http_422' });
});

test('an exhausted search quota does not block core calls', async () => {
  const later = String(Math.floor(Date.now() / 1000) + 600);
  const f = scripted([
    { res: res({ status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': later, 'x-ratelimit-resource': 'search' } }) },
    { res: res({ json: { truncated: false, tree: [{ path: 'SKILL.md', type: 'blob' }] }, headers: { 'x-ratelimit-remaining': '4999', 'x-ratelimit-resource': 'core' } }) }
  ]);
  const c = createGithubClient({ fetchImpl: f });
  assert.match((await c.searchRepositories('x')).error, /rate_limited/);
  assert.deepEqual(await c.listTreePaths('o', 'r', 'main'), { paths: ['SKILL.md'], truncated: false });
  assert.equal(f.calls.length, 2);
});

test('an exhausted core quota does not block search', async () => {
  const later = String(Math.floor(Date.now() / 1000) + 600);
  const f = scripted([
    { res: res({ status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': later, 'x-ratelimit-resource': 'core' } }) },
    { res: res({ json: { items: [{ full_name: 'o/r' }] }, headers: { 'x-ratelimit-remaining': '29', 'x-ratelimit-resource': 'search' } }) }
  ]);
  const c = createGithubClient({ fetchImpl: f });
  assert.match((await c.listTreePaths('o', 'r', 'main')).error, /rate_limited/);
  assert.deepEqual(await c.searchRepositories('x'), { items: [{ full_name: 'o/r' }] });
});

test('an exhausted bucket blocks its next call without a request', async () => {
  const later = String(Math.floor(Date.now() / 1000) + 600);
  const f = scripted([
    { res: res({ status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': later, 'x-ratelimit-resource': 'search' } }) }
  ]);
  const c = createGithubClient({ fetchImpl: f });
  await c.searchRepositories('x');
  assert.match((await c.searchRepositories('y')).error, /rate_limited/);
  assert.equal(f.calls.length, 1);
});

test('a search 403 without a resource header still exhausts only the search bucket', async () => {
  const later = String(Math.floor(Date.now() / 1000) + 600);
  const f = scripted([
    { res: res({ status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': later } }) },
    { res: res({ json: { truncated: false, tree: [] }, headers: okHeaders }) }
  ]);
  const c = createGithubClient({ fetchImpl: f });
  await c.searchRepositories('x');
  assert.deepEqual(await c.listTreePaths('o', 'r', 'main'), { paths: [], truncated: false });
  assert.match((await c.searchRepositories('y')).error, /rate_limited/);
  assert.equal(f.calls.length, 2);
});

test('an unexpected resource header falls back to the bucket of the request', async () => {
  const later = String(Math.floor(Date.now() / 1000) + 600);
  const f = scripted([
    { res: res({ status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': later, 'x-ratelimit-resource': '__proto__' } }) }
  ]);
  const c = createGithubClient({ fetchImpl: f });
  await c.listTreePaths('o', 'r', 'main');
  assert.equal(({}).remaining, undefined);
  assert.match((await c.listTreePaths('o', 'r', 'main')).error, /rate_limited/);
  assert.equal(f.calls.length, 1);
});

test('getRepo: returns name, archive state and SPDX license; 404 is missing', async () => {
  const f = scripted([
    { res: res({ json: { full_name: 'New/name', archived: true, disabled: false, license: { spdx_id: 'MIT' } }, headers: okHeaders }) },
    { res: res({ status: 404, json: {} }) }
  ]);
  const c = createGithubClient({ fetchImpl: f });
  assert.deepEqual(await c.getRepo('o', 'r'), { fullName: 'New/name', archived: true, disabled: false, license: 'MIT' });
  assert.match(f.calls[0].url, /\/repos\/o\/r$/);
  assert.deepEqual(await c.getRepo('o', 'gone'), { missing: true });
});

test('getRepo: no license is null, and a non-404 failure is an error', async () => {
  const f = scripted([
    { res: res({ json: { full_name: 'o/r', archived: false, disabled: false, license: null }, headers: okHeaders }) },
    { res: res({ status: 500, json: {} }) }
  ]);
  const c = createGithubClient({ fetchImpl: f });
  assert.equal((await c.getRepo('o', 'r')).license, null);
  assert.deepEqual(await c.getRepo('o', 'r'), { error: 'repo_http_500' });
});

test('getReadme: blob sha of whatever README the ref has; 404 is absent', async () => {
  const f = scripted([
    { res: res({ json: { type: 'file', path: 'readme.markdown', sha: SHA }, headers: okHeaders }) },
    { res: res({ status: 404, json: {} }) }
  ]);
  const c = createGithubClient({ fetchImpl: f });
  assert.deepEqual(await c.getReadme('o', 'r', 'abc'), { kind: 'blob', sha: SHA, path: 'readme.markdown' });
  assert.match(f.calls[0].url, /\/repos\/o\/r\/readme\?ref=abc$/);
  assert.deepEqual(await c.getReadme('o', 'r', 'abc'), { kind: 'absent' });
});

test('compareCommits: ahead_by from base to head; failures are errors', async () => {
  const f = scripted([
    { res: res({ json: { ahead_by: 7, status: 'ahead' }, headers: okHeaders }) },
    { res: res({ status: 404, json: {} }) }
  ]);
  const c = createGithubClient({ fetchImpl: f });
  assert.deepEqual(await c.compareCommits('o', 'r', 'aaa', 'bbb'), { aheadBy: 7 });
  assert.match(f.calls[0].url, /\/repos\/o\/r\/compare\/aaa\.\.\.bbb$/);
  assert.deepEqual(await c.compareCommits('o', 'r', 'aaa', 'bbb'), { error: 'compare_http_404' });
});
