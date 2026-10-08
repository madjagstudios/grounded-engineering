const MARKETPLACE = '.claude-plugin/marketplace.json';
const RANK = { OK: 0, DRIFTED: 1, ERROR: 2 };
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const error = (reason, detail = null) => ({ result: 'ERROR', reason, detail });
const drifted = (reason, detail = null) => ({ result: 'DRIFTED', reason, detail });

// One install source at the pin and at the head: a blob, absent, or a failed lookup.
async function compareSource(label, lookup, pin, head) {
  const [before, after] = [await lookup(pin), await lookup(head)];
  const failed = [before, after].find((o) => o.kind === 'error');
  if (failed) return error('lookup_failed', `${label}: ${failed.reason}`);
  const sha = (o) => (o.kind === 'blob' ? o.sha : null);
  return sha(before) === sha(after) ? null : drifted('install_source_changed', label);
}

async function watchOne(record, client) {
  const [owner, name] = record.repo.split('/');
  const findings = [];
  const out = (aheadBy = null) => ({ id: record.id, name: record.name, repo: record.repo, pinnedCommit: record.pinned_commit, aheadBy, findings });

  const repo = await client.getRepo(owner, name);
  if (repo.missing || repo.error) {
    findings.push(repo.missing ? error('missing') : error('lookup_failed', `repository: ${repo.error}`));
    return out();
  }
  if (repo.fullName.toLowerCase() !== record.repo.toLowerCase()) findings.push(error('renamed', repo.fullName));
  if (repo.archived) findings.push(error('archived'));
  if (repo.disabled) findings.push(error('disabled'));

  // GitHub reports the default branch's license; NOASSERTION means it could not classify it.
  if (repo.license === null) findings.push(error('license_missing'));
  else if (repo.license === 'NOASSERTION') findings.push(drifted('license_unrecognized'));
  else if (repo.license !== record.license) findings.push(error('license_changed', `${record.license} → ${repo.license}`));

  const head = await client.resolveHead(owner, name);
  if (head.error) {
    findings.push(error('lookup_failed', `head: ${head.error}`));
    return out();
  }

  const distance = await client.compareCommits(owner, name, record.pinned_commit, head.sha);
  // GitHub answers 404 when the pinned commit is gone, for example after a force-push.
  if (distance.error === 'compare_http_404') {
    findings.push(error('pinned_commit_unreadable'));
    return out();
  }
  if (distance.error) findings.push(error('lookup_failed', `compare: ${distance.error}`));

  for (const change of [
    await compareSource('README', (ref) => client.getReadme(owner, name, ref), record.pinned_commit, head.sha),
    await compareSource(MARKETPLACE, (ref) => client.getObject(owner, name, ref, MARKETPLACE), record.pinned_commit, head.sha)
  ]) if (change) findings.push(change);

  return out(distance.aheadBy ?? null);
}

export async function watchSkillRepos({ records, client }) {
  const listed = records.filter((r) => r.status === 'listed').sort((a, b) => cmp(a.id, b.id));
  const repos = [];
  for (const record of listed) {
    const repo = await watchOne(record, client);
    repo.status = repo.findings.reduce((acc, f) => (RANK[f.result] > RANK[acc] ? f.result : acc), 'OK');
    repos.push(repo);
  }
  const count = (status) => repos.filter((r) => r.status === status).length;
  const exitCode = count('ERROR') > 0 ? 2 : count('DRIFTED') > 0 ? 1 : 0;
  const headline = exitCode === 2 ? 'ERRORS' : exitCode === 1 ? 'DRIFT' : 'NO DRIFT';
  const summary = { checked: repos.length, ok: count('OK'), drifted: count('DRIFTED'), errored: count('ERROR'), networkCalls: client.callCount(), exitCode };
  return { repos, summary, headline, exitCode };
}
