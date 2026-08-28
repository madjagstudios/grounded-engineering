const SHA40 = /^[0-9a-f]{40}$/;
const BASE = 'https://api.github.com';
const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

export function createGithubClient({ fetchImpl = globalThis.fetch, token, timeoutMs = 15000 } = {}) {
  const authToken = token ?? process.env.GITHUB_TOKEN; // nullish; '' stays '' (no auth)
  const state = { remaining: null, reset: null, calls: 0 };
  const headers = () => {
    const h = { 'User-Agent': 'grounded-engineering-check-sources', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (authToken) h.Authorization = `Bearer ${authToken}`;
    return h;
  };

  async function request(url) {
    // Fail closed: remaining:0 blocks until we know the window has passed.
    if (state.remaining === 0 && (!state.reset || Date.now() / 1000 < state.reset)) {
      return { error: { reason: `rate_limited (reset ${state.reset ?? 'unknown'})` } };
    }
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((r) => { timer = setTimeout(() => { controller.abort(); r({ error: { reason: 'timeout' } }); }, timeoutMs); });
    state.calls += 1;
    try {
      const outcome = await Promise.race([
        Promise.resolve().then(() => fetchImpl(url, { headers: headers(), signal: controller.signal })).then((res) => ({ res }), (e) => ({ error: { reason: `fetch_failed: ${e.message}` } })),
        timeout
      ]);
      if (outcome.error) return outcome;
      const res = outcome.res;
      if (!res || !res.headers || typeof res.headers.get !== 'function') return { error: { reason: 'malformed_response' } };
      const rem = res.headers.get('x-ratelimit-remaining');
      const rst = res.headers.get('x-ratelimit-reset');
      if (rem !== null) state.remaining = Number(rem);
      if (rst !== null) state.reset = Number(rst);
      if ((res.status === 403 || res.status === 429) && (state.remaining === 0 || res.headers.get('retry-after'))) {
        return { error: { reason: `rate_limited (reset ${state.reset ?? 'unknown'})` } };
      }
      return { res };
    } finally {
      clearTimeout(timer);
    }
  }

  async function resolveHead(owner, repo) {
    const a = await request(`${BASE}/repos/${owner}/${repo}`);
    if (a.error) return { error: a.error.reason };
    if (!a.res.ok) return { error: `repo_http_${a.res.status}` };
    let repoJson; try { repoJson = await a.res.json(); } catch { return { error: 'repo_json_invalid' }; }
    const branch = repoJson?.default_branch;
    if (typeof branch !== 'string' || !branch) return { error: 'no_default_branch' };
    const b = await request(`${BASE}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`);
    if (b.error) return { error: b.error.reason };
    if (!b.res.ok) return { error: `commits_http_${b.res.status}` };
    let commits; try { commits = await b.res.json(); } catch { return { error: 'commits_json_invalid' }; }
    const sha = Array.isArray(commits) && commits[0] ? commits[0].sha : undefined;
    if (!SHA40.test(sha ?? '')) return { error: 'head_sha_invalid' };
    return { branch, sha };
  }

  async function getObject(owner, repo, ref, path) {
    const r = await request(`${BASE}/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);
    if (r.error) return { kind: 'error', reason: r.error.reason };
    const res = r.res;
    if (res.status === 404) return { kind: 'absent' };
    if (!res.ok) return { kind: 'error', status: res.status, reason: `http_${res.status}` };
    let json; try { json = await res.json(); } catch { return { kind: 'error', reason: 'json_invalid' }; }
    if (Array.isArray(json)) return { kind: 'dir' };
    if (json && json.submodule_git_url) return { kind: 'submodule' };
    if (json && json.type === 'symlink') return { kind: 'symlink' };
    if (json && json.type === 'file' && SHA40.test(json.sha ?? '')) return { kind: 'blob', sha: json.sha };
    return { kind: 'error', reason: 'unexpected_object' };
  }

  return { resolveHead, getObject, callCount: () => state.calls };
}
