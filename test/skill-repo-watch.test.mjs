import assert from 'node:assert/strict';
import test from 'node:test';
import { watchSkillRepos } from '../scripts/lib/skill-repo-watch.mjs';
import { runCheckSkillRepos } from '../scripts/check-skill-repos.mjs';

const PIN = 'a'.repeat(40), HEAD = 'b'.repeat(40);
const README_OLD = '1'.repeat(40), README_NEW = '2'.repeat(40);
const record = (over = {}) => ({ id: 'GE-SR-001', name: 'Alpha', repo: 'owner/alpha', license: 'MIT', pinned_commit: PIN, status: 'listed', ...over });

// The head is 3 commits past the pin; the README is unchanged and there is no marketplace file.
const upstream = (over = {}) => ({
  repo: { fullName: 'owner/alpha', archived: false, disabled: false, license: 'MIT' },
  readme: { [PIN]: README_OLD, [HEAD]: README_OLD },
  marketplace: {},
  aheadBy: 3,
  ...over
});
const fakeClient = (byRepo) => {
  let calls = 0;
  const of = (owner, repo) => byRepo[`${owner}/${repo}`];
  return {
    callCount: () => calls,
    getRepo: async (o, r) => { calls++; const u = of(o, r); return u.missing ? { missing: true } : u.repo; },
    resolveHead: async () => { calls++; return { branch: 'main', sha: HEAD }; },
    getReadme: async (o, r, ref) => { calls++; const sha = of(o, r).readme[ref]; return sha ? { kind: 'blob', sha, path: 'README.md' } : { kind: 'absent' }; },
    getObject: async (o, r, ref) => { calls++; const sha = of(o, r).marketplace[ref]; return sha ? { kind: 'blob', sha } : { kind: 'absent' }; },
    compareCommits: async (o, r) => { calls++; const u = of(o, r); return u.pinMissing ? { error: 'compare_http_404' } : { aheadBy: u.aheadBy }; }
  };
};
const run = (records, byRepo) => watchSkillRepos({ records, client: fakeClient(byRepo) });

test('an unchanged repository is OK, with how far its head has moved', async () => {
  const out = await run([record()], { 'owner/alpha': upstream() });
  assert.equal(out.exitCode, 0);
  assert.deepEqual(out.repos[0].findings, []);
  assert.equal(out.repos[0].status, 'OK');
  assert.equal(out.repos[0].aheadBy, 3);
});

test('a license that no longer matches the record is an error that names the record', async () => {
  const out = await run([record()], { 'owner/alpha': upstream({ repo: { fullName: 'owner/alpha', archived: false, disabled: false, license: 'GPL-3.0' } }) });
  assert.equal(out.exitCode, 2);
  assert.equal(out.repos[0].id, 'GE-SR-001');
  assert.deepEqual(out.repos[0].findings, [{ result: 'ERROR', reason: 'license_changed', detail: 'MIT → GPL-3.0' }]);
});

test('no license is an error; a license GitHub cannot classify needs a look', async () => {
  const none = await run([record()], { 'owner/alpha': upstream({ repo: { fullName: 'owner/alpha', archived: false, disabled: false, license: null } }) });
  assert.deepEqual(none.repos[0].findings.map((f) => f.reason), ['license_missing']);
  assert.equal(none.exitCode, 2);
  const unclear = await run([record()], { 'owner/alpha': upstream({ repo: { fullName: 'owner/alpha', archived: false, disabled: false, license: 'NOASSERTION' } }) });
  assert.deepEqual(unclear.repos[0].findings.map((f) => [f.result, f.reason]), [['DRIFTED', 'license_unrecognized']]);
  assert.equal(unclear.exitCode, 1);
});

test('archived, deleted and renamed repositories each get their own finding', async () => {
  const out = await run(
    [record(), record({ id: 'GE-SR-002', repo: 'owner/gone' }), record({ id: 'GE-SR-003', repo: 'owner/old-name' })],
    {
      'owner/alpha': upstream({ repo: { fullName: 'owner/alpha', archived: true, disabled: false, license: 'MIT' } }),
      'owner/gone': { missing: true },
      'owner/old-name': upstream({ repo: { fullName: 'someone/new-name', archived: false, disabled: false, license: 'MIT' } })
    }
  );
  assert.equal(out.exitCode, 2);
  assert.deepEqual(out.repos.map((r) => [r.id, r.findings.map((f) => f.reason)]), [
    ['GE-SR-001', ['archived']],
    ['GE-SR-002', ['missing']],
    ['GE-SR-003', ['renamed']]
  ]);
  assert.equal(out.repos[2].findings[0].detail, 'someone/new-name');
});

test('a README that changed since the pin is reported as an install source change', async () => {
  const out = await run([record()], { 'owner/alpha': upstream({ readme: { [PIN]: README_OLD, [HEAD]: README_NEW } }) });
  assert.equal(out.exitCode, 1);
  assert.deepEqual(out.repos[0].findings, [{ result: 'DRIFTED', reason: 'install_source_changed', detail: 'README' }]);
});

test('a marketplace manifest that appears after the pin is an install source change', async () => {
  const out = await run([record()], { 'owner/alpha': upstream({ marketplace: { [HEAD]: README_NEW } }) });
  assert.deepEqual(out.repos[0].findings.map((f) => f.detail), ['.claude-plugin/marketplace.json']);
});

test('a pinned commit the repository no longer has is an error', async () => {
  const out = await run([record()], { 'owner/alpha': upstream({ pinMissing: true }) });
  assert.deepEqual(out.repos[0].findings.map((f) => [f.result, f.reason]), [['ERROR', 'pinned_commit_unreadable']]);
  assert.equal(out.exitCode, 2);
});

test('records that are not listed are skipped, and the order is by id', async () => {
  const out = await run(
    [record({ id: 'GE-SR-002', repo: 'owner/beta' }), record({ status: 'delisted' }), record({ id: 'GE-SR-001', repo: 'owner/alpha' })],
    { 'owner/alpha': upstream(), 'owner/beta': upstream({ repo: { fullName: 'owner/beta', archived: false, disabled: false, license: 'MIT' } }) }
  );
  assert.deepEqual(out.repos.map((r) => r.id), ['GE-SR-001', 'GE-SR-002']);
});

const deps = (over = {}) => ({
  root: '/x',
  validate: () => ({ errors: [] }),
  loadRecords: () => ({ records: [record()], errors: [] }),
  createClient: () => fakeClient({ 'owner/alpha': upstream({ readme: { [PIN]: README_OLD, [HEAD]: README_NEW } }) }),
  ...over
});

test('check:skill-repos refuses to run on an invalid catalog and never builds a client', async () => {
  let built = 0, out = '';
  const code = await runCheckSkillRepos(deps({ validate: () => ({ errors: ['boom'] }), createClient: () => { built++; }, write: (s) => { out += s; } }));
  assert.equal(code, 2);
  assert.equal(built, 0);
  assert.match(out, /boom/);
});

test('check:skill-repos prints each finding by record and a summary with its network calls', async () => {
  let out = '';
  const code = await runCheckSkillRepos(deps({ write: (s) => { out += s; } }));
  assert.equal(code, 1);
  assert.match(out, /^check:skill-repos — DRIFT/);
  assert.match(out, /GE-SR-001 Alpha \(owner\/alpha\): DRIFTED/);
  assert.match(out, /install source changed: README/);
  assert.match(out, /network calls \d+/);
});

test('check:skill-repos --json carries every repo and the summary', async () => {
  let out = '';
  await runCheckSkillRepos(deps({ format: 'json', write: (s) => { out += s; } }));
  const json = JSON.parse(out);
  assert.equal(json.version, 1);
  assert.equal(json.repos[0].id, 'GE-SR-001');
  for (const key of ['checked', 'ok', 'drifted', 'errored', 'networkCalls', 'exitCode']) assert.ok(key in json.summary, key);
});
