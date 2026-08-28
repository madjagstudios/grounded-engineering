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
  assert.equal(f.calls[0].opts.headers['User-Agent'], 'grounded-engineering-check-sources');
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
  const err404 = createGithubClient({ fetchImpl: scripted([{ res: res({ status: 404, json: { default_branch: 'main' } }) }]) });
  assert.ok((await err404.resolveHead('o', 'r')).error);
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

test('rejected fetch → error; never-settling fetch ignoring signal → timeout', async () => {
  assert.match((await createGithubClient({ fetchImpl: async () => { throw new Error('network'); } }).getObject('o', 'r', SHA, 'a')).reason, /fetch_failed/);
  assert.match((await createGithubClient({ fetchImpl: () => new Promise(() => {}), timeoutMs: 20 }).getObject('o', 'r', SHA, 'a')).reason, /timeout/);
});
