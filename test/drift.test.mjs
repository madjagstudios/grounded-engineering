import assert from 'node:assert/strict';
import test from 'node:test';
import { detectDrift, reconcileTargets } from '../scripts/lib/drift.mjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), H = 'c'.repeat(40), H2 = 'e'.repeat(40);
const OKSHA = 'd'.repeat(40), PSHA = '1'.repeat(40), QSHA = '2'.repeat(40);
const src = (id, targets, kind = 'commit') => [id, { id, kind, immutableRefShas: targets.map((t) => t.commit), retrievalDate: kind === 'doc' ? '2026-08-26' : null, targets }];
const t = (commit, path = 'x.rs', owner = 'o', repo = 'r') => ({ owner, repo, commit, path, sourceId: 'x' });
const fake = ({ heads = {}, blobs = {}, headCalls = {}, objCalls = {}, throwHead = false } = {}) => ({
  callCount: () => 0,
  resolveHead: async (o, r) => { headCalls[`${o}/${r}`] = (headCalls[`${o}/${r}`] ?? 0) + 1; if (throwHead) throw new Error('boom'); return heads[`${o}/${r}`] ?? { error: 'no_head' }; },
  getObject: async (o, r, ref, path) => { const k = `${ref}\n${path}`; objCalls[k] = (objCalls[k] ?? 0) + 1; return blobs[k] ?? { kind: 'absent' }; }
});
const one = (id, commit, path = 'x.rs') => new Map([src(id, [t(commit, path)])]);

test('OK / DRIFTED(content) / missing_at_head / pinned_absent', async () => {
  const ok = await detectDrift({ registry: one('CODEX-A', A), cards: [], client: fake({ heads: { 'o/r': { sha: H } }, blobs: { [`${A}\nx.rs`]: { kind: 'blob', sha: OKSHA }, [`${H}\nx.rs`]: { kind: 'blob', sha: OKSHA } } }) });
  assert.equal(ok.sources[0].status, 'OK'); assert.equal(ok.exitCode, 0);
  const dr = await detectDrift({ registry: one('CODEX-A', A), cards: [], client: fake({ heads: { 'o/r': { sha: H } }, blobs: { [`${A}\nx.rs`]: { kind: 'blob', sha: PSHA }, [`${H}\nx.rs`]: { kind: 'blob', sha: QSHA } } }) });
  assert.equal(dr.sources[0].status, 'DRIFTED'); assert.equal(dr.exitCode, 1);
  const mh = await detectDrift({ registry: one('CODEX-A', A), cards: [], client: fake({ heads: { 'o/r': { sha: H } }, blobs: { [`${A}\nx.rs`]: { kind: 'blob', sha: PSHA }, [`${H}\nx.rs`]: { kind: 'absent' } } }) });
  assert.equal(mh.sources[0].reason, 'missing_at_head');
  const pa = await detectDrift({ registry: one('CODEX-A', A), cards: [], client: fake({ heads: { 'o/r': { sha: H } }, blobs: { [`${A}\nx.rs`]: { kind: 'absent' } } }) });
  assert.equal(pa.sources[0].status, 'ERROR'); assert.equal(pa.exitCode, 2);
});

test('a REJECTED client call becomes ERROR, not an unhandled rejection', async () => {
  const out = await detectDrift({ registry: one('CODEX-A', A), cards: [], client: fake({ throwHead: true }) });
  assert.equal(out.sources[0].status, 'ERROR');
  assert.equal(out.exitCode, 2);
});

test('a client that RESOLVES to a non-object (dropped/malformed) becomes ERROR, exit 2', async () => {
  const bad = { callCount: () => 0, resolveHead: async () => ({ branch: 'main', sha: H }), getObject: async () => undefined };
  const out = await detectDrift({ registry: one('CODEX-A', A), cards: [], client: bad });
  assert.equal(out.sources[0].status, 'ERROR');
  assert.match(out.sources[0].reason, /malformed_response/);
  assert.equal(out.exitCode, 2);
});

test('a thrown non-Error value (throw null) still becomes ERROR, not a second throw', async () => {
  const bad = { callCount: () => 0, resolveHead: async () => { throw null; }, getObject: async () => ({ kind: 'blob', sha: A }) };
  const out = await detectDrift({ registry: one('CODEX-A', A), cards: [], client: bad });
  assert.equal(out.sources[0].status, 'ERROR');
  assert.equal(out.exitCode, 2);
});

test('a head without a valid sha, and a blob without a valid sha, are ERROR (no false OK)', async () => {
  const noHeadSha = { callCount: () => 0, resolveHead: async () => ({}), getObject: async () => ({ kind: 'blob', sha: A }) };
  const o1 = await detectDrift({ registry: one('CODEX-A', A), cards: [], client: noHeadSha });
  assert.equal(o1.sources[0].status, 'ERROR'); assert.match(o1.sources[0].reason, /malformed_head/);
  const noBlobSha = { callCount: () => 0, resolveHead: async () => ({ branch: 'main', sha: H }), getObject: async () => ({ kind: 'blob' }) };
  const o2 = await detectDrift({ registry: one('CODEX-A', A), cards: [], client: noBlobSha });
  assert.equal(o2.sources[0].status, 'ERROR'); // undefined===undefined must NOT be OK
});

test('reconcileTargets: a missing terminal result becomes unresolved_target, accountingOk false', () => {
  const tr = new Map([['k1', { result: 'OK' }]]);
  const ok = reconcileTargets(['k1', 'k2'], tr);
  assert.equal(ok, false);
  assert.deepEqual(tr.get('k2'), { result: 'ERROR', reason: 'unresolved_target' });
});

test('determinism: reversed repo + card input → identical repoHeads/sources and serialized JSON', async () => {
  const heads = { 'o/r1': { branch: 'main', sha: H }, 'o/r2': { branch: 'main', sha: H2 } };
  const blobs = { [`${A}\na.rs`]: { kind: 'blob', sha: OKSHA }, [`${H}\na.rs`]: { kind: 'blob', sha: OKSHA }, [`${A}\nb.rs`]: { kind: 'blob', sha: OKSHA }, [`${H2}\nb.rs`]: { kind: 'blob', sha: OKSHA } };
  const sA = src('CODEX-A', [t(A, 'a.rs', 'o', 'r1')]);
  const sB = src('CODEX-B', [t(A, 'b.rs', 'o', 'r2')]);
  const c1 = { id: 'GE-1', source_ids: ['CODEX-A'], validation: { status: 'not_validated' } };
  const c2 = { id: 'GE-2', source_ids: ['CODEX-B'], validation: { status: 'not_validated' } };
  const mk = (reg, cards) => detectDrift({ registry: new Map(reg), cards, client: fake({ heads, blobs }) });
  const out1 = await mk([sA, sB], [c1, c2]);
  const out2 = await mk([sB, sA], [c2, c1]);
  assert.deepEqual(out1.repoHeads, out2.repoHeads);
  assert.deepEqual(out1.sources, out2.sources);
  assert.equal(JSON.stringify(out1), JSON.stringify(out2));
});

test('dedup: shared target fetched once; resolveHead once per repo; both sources reported', async () => {
  const headCalls = {}, objCalls = {};
  const reg = new Map([src('CODEX-A', [t(A, 's.rs')]), src('CODEX-B', [t(A, 's.rs')])]);
  const out = await detectDrift({ registry: reg, cards: [], client: fake({ heads: { 'o/r': { sha: H } }, blobs: { [`${A}\ns.rs`]: { kind: 'blob', sha: OKSHA }, [`${H}\ns.rs`]: { kind: 'blob', sha: OKSHA } }, headCalls, objCalls }) });
  assert.equal(headCalls['o/r'], 1); assert.equal(objCalls[`${A}\ns.rs`], 1);
  assert.equal(out.summary.rawTargetCount, 2); assert.equal(out.summary.distinctTargetCount, 1); assert.equal(out.sources.length, 2);
});

test('multi-target source aggregates ERROR>DRIFTED>OK', async () => {
  const reg = new Map([src('CODEX-A', [t(A, 'a.rs'), t(B, 'b.rs')])]);
  const out = await detectDrift({ registry: reg, cards: [], client: fake({ heads: { 'o/r': { sha: H } }, blobs: { [`${A}\na.rs`]: { kind: 'blob', sha: PSHA }, [`${H}\na.rs`]: { kind: 'blob', sha: QSHA }, [`${B}\nb.rs`]: { kind: 'blob', sha: OKSHA }, [`${H}\nb.rs`]: { kind: 'blob', sha: OKSHA } } }) });
  assert.equal(out.sources[0].status, 'DRIFTED'); // A drifted, B ok
  assert.deepEqual(out.sources[0].targets.map((x) => x.result).sort(), ['DRIFTED', 'OK']);
});

test('repo-head failure → ERROR for every target in that repo, exit 2', async () => {
  const out = await detectDrift({ registry: new Map([src('CODEX-A', [t(A)]), src('CODEX-B', [t(B)])]), cards: [], client: fake({ heads: {} }) });
  assert.ok(out.sources.every((s) => s.status === 'ERROR')); assert.equal(out.exitCode, 2);
});

test('affected cards flagged validated vs not', async () => {
  const cards = [
    { id: 'GE-1', source_ids: ['CODEX-A'], validation: { status: 'validated', validated_against: [{ source_id: 'CODEX-A', revisions: [A] }] } },
    { id: 'GE-2', source_ids: ['CODEX-A'], validation: { status: 'not_validated' } }
  ];
  const out = await detectDrift({ registry: one('CODEX-A', A), cards, client: fake({ heads: { 'o/r': { sha: H } }, blobs: { [`${A}\nx.rs`]: { kind: 'blob', sha: PSHA }, [`${H}\nx.rs`]: { kind: 'blob', sha: QSHA } } }) });
  assert.deepEqual(out.sources[0].cards, [{ id: 'GE-1', validated: true }, { id: 'GE-2', validated: false }]);
});

test('all-doc → NO AUTOMATABLE SOURCES; sourcesWithZeroCards counted', async () => {
  const out = await detectDrift({ registry: new Map([src('CLAUDE-D', [], 'doc')]), cards: [], client: fake() });
  assert.equal(out.headline, 'NO AUTOMATABLE SOURCES'); assert.equal(out.exitCode, 0);
  assert.equal(out.summary.docSources, 1); assert.equal(out.summary.sourcesWithZeroCards, 1);
});

test('nested target order is deterministic regardless of input order', async () => {
  const client = fake({ heads: { 'o/r': { sha: H } }, blobs: { [`${A}\na.rs`]: { kind: 'blob', sha: OKSHA }, [`${H}\na.rs`]: { kind: 'blob', sha: OKSHA }, [`${B}\nb.rs`]: { kind: 'blob', sha: OKSHA }, [`${H}\nb.rs`]: { kind: 'blob', sha: OKSHA } } });
  const mk = (order) => detectDrift({ registry: new Map([src('CODEX-A', order)]), cards: [], client });
  const a = (await mk([t(A, 'a.rs'), t(B, 'b.rs')])).sources[0].targets;
  const b = (await mk([t(B, 'b.rs'), t(A, 'a.rs')])).sources[0].targets;
  assert.deepEqual(a, b);
});
