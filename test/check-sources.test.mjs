import assert from 'node:assert/strict';
import test from 'node:test';
import { runCheckSources } from '../scripts/check-sources.mjs';

const A = 'a'.repeat(40), H = 'b'.repeat(40), P = '1'.repeat(40), Q = '2'.repeat(40);
const okClient = () => ({ callCount: () => 2, resolveHead: async () => ({ branch: 'main', sha: H }), getObject: async (o, r, ref) => ({ kind: 'blob', sha: ref === A ? P : Q }) });
const reg = new Map([['CODEX-A', { id: 'CODEX-A', kind: 'commit', immutableRefShas: [A], retrievalDate: null, targets: [{ owner: 'o', repo: 'r', commit: A, path: 'x.rs', sourceId: 'CODEX-A' }] }], ['CLAUDE-D', { id: 'CLAUDE-D', kind: 'doc', immutableRefShas: [], retrievalDate: '2026-08-26', targets: [] }]]);
const cards = [{ id: 'GE-1', source_ids: ['CODEX-A'], validation: { status: 'validated', validated_against: [{ source_id: 'CODEX-A', revisions: [A] }] } }];
const deps = (over = {}) => ({ root: '/x', validate: () => ({ errors: [] }), buildRegistry: () => ({ registry: reg, errors: [] }), loadCards: () => cards, createClient: okClient, ...over });

test('gate: validator errors → exit 2, and the client is NEVER constructed', async () => {
  let constructed = 0, out = '';
  const code = await runCheckSources(deps({ validate: () => ({ errors: ['boom'] }), createClient: () => { constructed++; return okClient(); }, write: (s) => { out += s; } }));
  assert.equal(code, 2); assert.equal(constructed, 0); assert.match(out, /boom/);
});

test('reports drift, exit 1, names validated card; doc line uses exact N/A form', async () => {
  let out = '';
  const code = await runCheckSources(deps({ write: (s) => { out += s; } }));
  assert.equal(code, 1);
  assert.match(out, /DRIFT/); assert.match(out, /CODEX-A/); assert.match(out, /GE-1/); assert.match(out, /validated/);
  assert.match(out, /N\/A doc — manual re-audit/);
});

test('--json is byte-identical across source-map input order and has the full contract', async () => {
  const cap = async (order) => { let s = ''; const r = new Map(order.map((id) => [id, { id, kind: 'commit', immutableRefShas: [A], retrievalDate: null, targets: [{ owner: 'o', repo: 'r', commit: A, path: `${id}.rs`, sourceId: id }] }])); await runCheckSources(deps({ buildRegistry: () => ({ registry: r, errors: [] }), loadCards: () => [], format: 'json', write: (x) => { s += x; } })); return s; };
  const a = await cap(['CODEX-A', 'CODEX-B']); const b = await cap(['CODEX-B', 'CODEX-A']);
  assert.equal(a, b);
  const j = JSON.parse(a);
  assert.equal(j.version, 1);
  assert.ok(Array.isArray(j.sources) && Array.isArray(j.repoHeads));
  for (const k of ['rawTargetCount', 'distinctTargetCount', 'checked', 'ok', 'drifted', 'errored', 'commitSources', 'docSources', 'sourcesWithZeroCards', 'networkCalls', 'exitCode']) assert.ok(k in j.summary, k);
});
