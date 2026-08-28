const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const RANK = { OK: 1, DRIFTED: 2, ERROR: 3 };
const SHA40 = /^[0-9a-f]{40}$/;
const dkey = (t) => [t.owner, t.repo, t.commit, t.path].join('\n');

// Defensive reconciliation (exported so it is directly testable): every distinct
// target key must map to a terminal OK/DRIFTED/ERROR; a missing one becomes an
// accounting ERROR and flips accountingOk false.
export function reconcileTargets(distinctKeys, targetResult) {
  let accountingOk = true;
  for (const key of distinctKeys) {
    const r = targetResult.get(key);
    if (!r || !RANK[r.result]) { targetResult.set(key, { result: 'ERROR', reason: 'unresolved_target' }); accountingOk = false; }
  }
  return accountingOk;
}

export async function detectDrift({ registry, cards, client }) {
  const records = [...registry.values()];
  const commitSources = records.filter((r) => r.kind === 'commit');
  const docSources = records.filter((r) => r.kind === 'doc');

  const cardsBySource = new Map();
  for (const card of cards) for (const sid of card.source_ids ?? []) {
    if (!cardsBySource.has(sid)) cardsBySource.set(sid, []);
    cardsBySource.get(sid).push(card);
  }
  const validatedAgainst = (card, sid) => card.validation?.status === 'validated' && (card.validation?.validated_against ?? []).some((e) => e.source_id === sid);
  const affected = (sid) => (cardsBySource.get(sid) ?? []).map((c) => ({ id: c.id, validated: validatedAgainst(c, sid) })).sort((a, b) => cmp(a.id, b.id));

  const rawTargets = commitSources.flatMap((r) => r.targets);
  const distinct = new Map();
  for (const t of rawTargets) if (!distinct.has(dkey(t))) distinct.set(dkey(t), t);

  const heads = new Map(); // "owner/repo" → result
  const repoHeads = [];
  // Catch throws (of any value) AND resolved-but-malformed results; never let a client call drop a target.
  const call = async (fn) => { try { return await fn(); } catch (e) { return { __threw: String(e?.message ?? e) }; } };
  const obj = (v) => v && typeof v === 'object';
  for (const t of distinct.values()) {
    const rk = `${t.owner}/${t.repo}`;
    if (!heads.has(rk)) {
      const h = await call(() => client.resolveHead(t.owner, t.repo));
      let norm;
      if (!obj(h)) norm = { error: 'malformed_head' };
      else if (h.__threw) norm = { error: `threw: ${h.__threw}` };
      else if (h.error) norm = h;
      else if (SHA40.test(h.sha ?? '')) norm = h;      // require a real head sha
      else norm = { error: 'malformed_head' };
      heads.set(rk, norm);
      repoHeads.push({ owner: t.owner, repo: t.repo, branch: norm.branch ?? null, head: norm.sha ?? null, error: norm.error ?? null });
    }
  }

  const getObj = async (t, ref) => {
    const o = await call(() => client.getObject(t.owner, t.repo, ref, t.path));
    if (obj(o) && o.__threw) return { kind: 'error', reason: `threw: ${o.__threw}` };
    if (!obj(o) || !('kind' in o)) return { kind: 'error', reason: 'malformed_response' };
    if (o.kind === 'blob' && !SHA40.test(o.sha ?? '')) return { kind: 'error', reason: 'malformed_response' }; // require a real blob sha
    return o;
  };
  const classify = async (t) => {
    const h = heads.get(`${t.owner}/${t.repo}`);
    if (h.error) return { result: 'ERROR', reason: `head_${h.error}` };
    const pinned = await getObj(t, t.commit);
    if (pinned.kind === 'error') return { result: 'ERROR', reason: pinned.reason };
    if (pinned.kind === 'absent') return { result: 'ERROR', reason: 'pinned_absent' };
    if (pinned.kind !== 'blob') return { result: 'ERROR', reason: 'unsupported_object' };
    const head = await getObj(t, h.sha);
    if (head.kind === 'error') return { result: 'ERROR', reason: head.reason };
    if (head.kind === 'absent') return { result: 'DRIFTED', reason: 'missing_at_head' };
    if (head.kind !== 'blob') return { result: 'ERROR', reason: 'unsupported_object' };
    return pinned.sha === head.sha ? { result: 'OK', reason: null } : { result: 'DRIFTED', reason: 'content' };
  };

  const targetResult = new Map();
  for (const [key, t] of distinct) targetResult.set(key, await classify(t));

  const accountingOk = reconcileTargets([...distinct.keys()], targetResult);

  const sources = [];
  for (const r of commitSources) {
    const tRes = r.targets
      .map((t) => ({ commit: t.commit, path: t.path, ...targetResult.get(dkey(t)) }))
      .sort((a, b) => cmp(`${a.commit}\n${a.path}`, `${b.commit}\n${b.path}`));
    const status = tRes.reduce((acc, x) => (RANK[x.result] > RANK[acc] ? x.result : acc), 'OK');
    const winners = tRes.filter((x) => x.result === status).map((x) => x.reason).filter(Boolean).sort(cmp);
    sources.push({ source_id: r.id, kind: 'commit', status, reason: status === 'OK' ? null : (winners[0] ?? null), targets: tRes.map((x) => ({ commit: x.commit, path: x.path, result: x.result, reason: x.reason ?? null })), cards: affected(r.id) });
  }
  for (const r of docSources) sources.push({ source_id: r.id, kind: 'doc', status: 'NA', reason: 'manual re-audit', targets: [], cards: affected(r.id) });
  sources.sort((a, b) => cmp(a.source_id, b.source_id));

  const vals = [...targetResult.values()];
  const ok = vals.filter((x) => x.result === 'OK').length;
  const drifted = vals.filter((x) => x.result === 'DRIFTED').length;
  const errored = vals.filter((x) => x.result === 'ERROR').length;
  const headline = commitSources.length === 0 ? 'NO AUTOMATABLE SOURCES' : (errored > 0 || !accountingOk ? 'ERRORS' : drifted > 0 ? 'DRIFT' : 'NO DRIFT');
  const exitCode = (errored > 0 || !accountingOk) ? 2 : drifted > 0 ? 1 : 0;
  const summary = {
    rawTargetCount: rawTargets.length, distinctTargetCount: distinct.size, checked: targetResult.size,
    ok, drifted, errored, commitSources: commitSources.length, docSources: docSources.length,
    sourcesWithZeroCards: records.filter((r) => affected(r.id).length === 0).length,
    networkCalls: client.callCount(), exitCode
  };
  return { repoHeads: repoHeads.sort((a, b) => cmp(`${a.owner}/${a.repo}`, `${b.owner}/${b.repo}`)), sources, summary, headline, exitCode };
}
