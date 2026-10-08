import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import process from 'node:process';
import { runValidation } from './validate.mjs';
import { loadSkillRepos } from '../src/lib/skill-repos.mjs';
import { createGithubClient } from './lib/github.mjs';
import { watchSkillRepos } from './lib/skill-repo-watch.mjs';

const REASONS = {
  missing: 'repository not found',
  renamed: 'renamed or transferred to',
  archived: 'archived',
  disabled: 'disabled',
  license_missing: 'no license detected',
  license_unrecognized: 'license not recognized by GitHub; check it by hand',
  license_changed: 'license changed',
  pinned_commit_unreadable: 'pinned commit not found',
  install_source_changed: 'install source changed:',
  lookup_failed: 'lookup failed:'
};

function renderText({ headline, repos, summary }) {
  const lines = [`check:skill-repos — ${headline}`, ''];
  for (const r of repos) {
    const ahead = r.aheadBy === null ? '' : r.aheadBy === 0 ? ', at the pin' : `, ${r.aheadBy} commit${r.aheadBy === 1 ? '' : 's'} past the pin`;
    lines.push(`${r.id} ${r.name} (${r.repo}): ${r.status}${ahead}`);
    for (const f of r.findings) lines.push(`    - ${f.result}: ${REASONS[f.reason] ?? f.reason}${f.detail ? ` ${f.detail}` : ''}`);
  }
  lines.push('', `repos: ${summary.checked} | ok ${summary.ok} drifted ${summary.drifted} errored ${summary.errored} | network calls ${summary.networkCalls}`);
  return lines.join('\n') + '\n';
}

export async function runCheckSkillRepos({
  root,
  validate = runValidation,
  loadRecords = loadSkillRepos,
  createClient = createGithubClient,
  format = 'text',
  write = (s) => process.stdout.write(s)
}) {
  const { errors } = validate({ root });
  if (errors.length > 0) {
    write(`check:skill-repos refuses to run — the catalog is not valid (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n`);
    for (const e of errors) write(`- ${e}\n`);
    return 2;
  }
  const { records } = loadRecords(root);
  const out = await watchSkillRepos({ records, client: createClient() });
  write(format === 'json'
    ? JSON.stringify({ version: 1, repos: out.repos, summary: out.summary }, null, 2) + '\n'
    : renderText(out));
  return out.exitCode;
}

const isMain = process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
if (isMain) {
  const format = process.argv.includes('--json') ? 'json' : 'text';
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  runCheckSkillRepos({ root, format }).then((code) => process.exit(code));
}
