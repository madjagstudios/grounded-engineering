import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { runValidation } from './validate.mjs';
import { createGithubClient } from './lib/github.mjs';
import { loadSkillRepos } from '../src/lib/skill-repos.mjs';

export const QUERIES = ['topic:claude-skills', 'topic:agent-skills', 'topic:claude-code-skills'];
const ACTIVE_DAYS = 90;
const BAD_LICENSES = new Set(['NOASSERTION', 'NONE', '']);

export async function runDiscover({ root, client, now = new Date(), write = (s) => process.stdout.write(s) }) {
  const { errors } = runValidation({ root });
  if (errors.length > 0) {
    write(`discover:skill-repos refuses to run — the catalog is not valid (${errors.length} issue${errors.length === 1 ? '' : 's'}).\n`);
    return 2;
  }
  const known = new Set(loadSkillRepos(root).records.map((r) => r.repo.toLowerCase()));
  const cutoff = new Date(now.getTime() - ACTIVE_DAYS * 86400000).toISOString().slice(0, 10);
  const gh = client ?? createGithubClient();
  const seen = new Map();
  for (const q of QUERIES) {
    const result = await gh.searchRepositories(`${q} fork:false archived:false pushed:>=${cutoff}`);
    if (result.error) { write(`search failed for ${q}: ${result.error}\n`); continue; }
    for (const it of result.items) if (!seen.has(it.full_name.toLowerCase())) seen.set(it.full_name.toLowerCase(), it);
  }

  const candidates = [];
  for (const [key, it] of seen) {
    if (known.has(key) || it.archived || it.fork) continue;
    if (!it.license || BAD_LICENSES.has(it.license.spdx_id ?? '')) continue;
    if ((it.pushed_at ?? '').slice(0, 10) < cutoff) continue;
    const [owner, repo] = it.full_name.split('/');
    const tree = await gh.listTreePaths(owner, repo, it.default_branch);
    if (tree.error || !tree.paths.some((p) => p === 'SKILL.md' || p.endsWith('/SKILL.md'))) continue;
    candidates.push({ ...it, skillCount: tree.paths.filter((p) => p === 'SKILL.md' || p.endsWith('/SKILL.md')).length });
  }

  candidates.sort((a, b) => b.stargazers_count - a.stargazers_count || a.full_name.localeCompare(b.full_name));
  write(`Report only. ${candidates.length} candidate${candidates.length === 1 ? '' : 's'} not yet recorded (active since ${cutoff}).\n`);
  write('Read each repository before writing a record; see research/skill-repos/README.md.\n\n');
  for (const c of candidates) {
    write(`${c.full_name}\t${c.license.spdx_id}\t${c.skillCount} SKILL.md\tpushed ${c.pushed_at.slice(0, 10)}\t${c.stargazers_count} stars\n`);
  }
  return 0;
}

const isMain = process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
if (isMain) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  runDiscover({ root }).then((code) => process.exit(code));
}
