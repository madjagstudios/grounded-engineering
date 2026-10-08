export const LABEL = 'upstream-drift';
const BASE = 'https://api.github.com';

// One open issue carries the latest report. Findings create it or replace its body;
// a clean run closes it. Nothing else in the repository is written.
export async function syncIssue({ api, title, body, clean, note }) {
  const open = await api.findOpenIssue();
  if (clean) {
    if (!open) return { action: 'none' };
    await api.comment(open.number, note);
    await api.close(open.number);
    return { action: 'closed', number: open.number };
  }
  if (open) {
    await api.update(open.number, body);
    await api.comment(open.number, note);
    return { action: 'updated', number: open.number };
  }
  await api.ensureLabel();
  return { action: 'created', number: await api.create(title, body) };
}

export function createIssuesApi({ token, repository, fetchImpl = globalThis.fetch }) {
  const call = async (method, path, payload) => {
    const res = await fetchImpl(`${BASE}/repos/${repository}${path}`, {
      method,
      headers: { 'User-Agent': 'grounded-engineering', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: `Bearer ${token}` },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
    return { res, json: await res.json().catch(() => null) };
  };
  const must = async (method, path, payload) => {
    const { res, json } = await call(method, path, payload);
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${json?.message ?? ''}`.trim());
    return json;
  };
  return {
    findOpenIssue: async () => {
      const list = await must('GET', `/issues?labels=${LABEL}&state=open&per_page=10`);
      const issue = (list ?? []).find((i) => !i.pull_request);
      return issue ? { number: issue.number } : null;
    },
    ensureLabel: async () => {
      const { res, json } = await call('POST', '/labels', { name: LABEL, color: 'd97757', description: 'A pinned source or listed skill repository changed upstream' });
      if (!res.ok && res.status !== 422) throw new Error(`POST /labels failed: ${res.status} ${json?.message ?? ''}`.trim());
    },
    create: async (title, body) => (await must('POST', '/issues', { title, body, labels: [LABEL] })).number,
    update: async (number, body) => { await must('PATCH', `/issues/${number}`, { body }); },
    comment: async (number, body) => { await must('POST', `/issues/${number}/comments`, { body }); },
    close: async (number) => { await must('PATCH', `/issues/${number}`, { state: 'closed', state_reason: 'completed' }); }
  };
}
