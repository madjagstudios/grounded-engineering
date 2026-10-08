import assert from 'node:assert/strict';
import test from 'node:test';
import { syncIssue, createIssuesApi, LABEL } from '../scripts/lib/upstream-issue.mjs';
import { runUpstreamWatch } from '../scripts/upstream-watch.mjs';

// An in-memory issue tracker with the same calls as createIssuesApi.
const tracker = (open = []) => {
  const issues = open.map((i) => ({ comments: [], state: 'open', labels: [LABEL], ...i }));
  let next = 100;
  const api = {
    issues,
    labelsEnsured: 0,
    findOpenIssue: async () => issues.find((i) => i.state === 'open' && i.labels.includes(LABEL)) ?? null,
    ensureLabel: async () => { api.labelsEnsured++; },
    create: async (title, body) => { const n = next++; issues.push({ number: n, title, body, labels: [LABEL], state: 'open', comments: [] }); return n; },
    update: async (number, body) => { issues.find((i) => i.number === number).body = body; },
    comment: async (number, body) => { issues.find((i) => i.number === number).comments.push(body); },
    close: async (number) => { issues.find((i) => i.number === number).state = 'closed'; }
  };
  return api;
};

test('findings with no open issue create one, labelled', async () => {
  const api = tracker();
  const result = await syncIssue({ api, title: 'Upstream changes to review', body: 'report 1', clean: false, note: 'n' });
  assert.equal(result.action, 'created');
  assert.equal(api.issues.length, 1);
  assert.equal(api.labelsEnsured, 1);
  assert.equal(api.issues[0].body, 'report 1');
});

test('a second run with findings updates the same issue instead of opening another', async () => {
  const api = tracker();
  await syncIssue({ api, title: 't', body: 'report 1', clean: false, note: 'first' });
  const result = await syncIssue({ api, title: 't', body: 'report 2', clean: false, note: 'second' });
  assert.equal(result.action, 'updated');
  assert.equal(api.issues.length, 1);
  assert.equal(api.issues[0].body, 'report 2');
  assert.deepEqual(api.issues[0].comments, ['second']);
});

test('a clean run closes the open issue with a comment', async () => {
  const api = tracker([{ number: 7, body: 'old' }]);
  const result = await syncIssue({ api, title: 't', body: 'clean report', clean: true, note: 'clean now' });
  assert.equal(result.action, 'closed');
  assert.equal(api.issues[0].state, 'closed');
  assert.deepEqual(api.issues[0].comments, ['clean now']);
});

test('a clean run with no open issue does nothing', async () => {
  const api = tracker();
  assert.equal((await syncIssue({ api, title: 't', body: 'b', clean: true, note: 'n' })).action, 'none');
  assert.equal(api.issues.length, 0);
});

const res = (status, json) => ({ status, ok: status >= 200 && status < 300, json: async () => json });
const recording = (answers) => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : undefined, auth: opts.headers.Authorization }); return answers.shift(); };
  return { calls, fetchImpl };
};

test('the issues API skips pull requests, tolerates an existing label, and sends the token', async () => {
  const { calls, fetchImpl } = recording([
    res(200, [{ number: 3, pull_request: {} }, { number: 4 }]),
    res(422, { message: 'already_exists' }),
    res(201, { number: 9 })
  ]);
  const api = createIssuesApi({ token: 'tok', repository: 'o/r', fetchImpl });
  assert.deepEqual(await api.findOpenIssue(), { number: 4 });
  assert.match(calls[0].url, /\/repos\/o\/r\/issues\?labels=upstream-drift&state=open/);
  assert.equal(calls[0].auth, 'Bearer tok');
  await api.ensureLabel();
  assert.equal(calls[1].method, 'POST');
  assert.equal(await api.create('t', 'b'), 9);
  assert.deepEqual(calls[2].body, { title: 't', body: 'b', labels: ['upstream-drift'] });
});

test('the issues API pages past labelled pull requests to find the issue', async () => {
  const prs = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, pull_request: {} }));
  const { calls, fetchImpl } = recording([res(200, prs), res(200, [{ number: 101, pull_request: {} }, { number: 150 }])]);
  const api = createIssuesApi({ token: 'tok', repository: 'o/r', fetchImpl });
  assert.deepEqual(await api.findOpenIssue(), { number: 150 });
  assert.match(calls[0].url, /per_page=100&page=1$/);
  assert.match(calls[1].url, /per_page=100&page=2$/);
});

test('the issues API stops paging when a short page has no issue', async () => {
  const { calls, fetchImpl } = recording([res(200, [{ number: 3, pull_request: {} }])]);
  const api = createIssuesApi({ token: 'tok', repository: 'o/r', fetchImpl });
  assert.equal(await api.findOpenIssue(), null);
  assert.equal(calls.length, 1);
});

test('the issues API throws on a failed write', async () => {
  const { fetchImpl } = recording([res(403, { message: 'Resource not accessible by integration' })]);
  const api = createIssuesApi({ token: 'tok', repository: 'o/r', fetchImpl });
  await assert.rejects(api.update(4, 'b'), /403/);
});

const check = (code, text) => async ({ write }) => { write(text); return code; };
const env = { GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '42' };

test('the weekly run puts both reports and the run link in the issue', async () => {
  const api = tracker();
  const code = await runUpstreamWatch({ api, env, runSources: check(0, 'sources: NO DRIFT\n'), runSkillRepos: check(1, 'skill repos: DRIFT\n'), write: () => {} });
  assert.equal(code, 0);
  const body = api.issues[0].body;
  assert.match(body, /sources: NO DRIFT/);
  assert.match(body, /skill repos: DRIFT/);
  assert.match(body, /https:\/\/github\.com\/o\/r\/actions\/runs\/42/);
});

test('a run whose checks could not finish is not treated as clean', async () => {
  const api = tracker([{ number: 7, body: 'old' }]);
  await runUpstreamWatch({ api, env, runSources: check(2, 'rate limited\n'), runSkillRepos: check(0, 'ok\n'), write: () => {} });
  assert.equal(api.issues[0].state, 'open');
  assert.match(api.issues[0].body, /rate limited/);
});

test('when both checks are clean the issue closes', async () => {
  const api = tracker([{ number: 7, body: 'old' }]);
  await runUpstreamWatch({ api, env, runSources: check(0, 'a\n'), runSkillRepos: check(0, 'b\n'), write: () => {} });
  assert.equal(api.issues[0].state, 'closed');
});
