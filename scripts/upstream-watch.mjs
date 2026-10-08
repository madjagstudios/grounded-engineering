import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import process from 'node:process';
import { runCheckSources } from './check-sources.mjs';
import { runCheckSkillRepos } from './check-skill-repos.mjs';
import { syncIssue, createIssuesApi } from './lib/upstream-issue.mjs';

const TITLE = 'Upstream changes to review';

const capture = async (run, root) => {
  let text = '';
  const code = await run({ root, write: (s) => { text += s; } });
  return { code, text };
};

const section = (heading, command, { code, text }) =>
  `## ${heading}\n\n\`${command}\` exited ${code}.\n\n\`\`\`text\n${text.trimEnd()}\n\`\`\``;

export async function runUpstreamWatch({ root, api, env = process.env, runSources = runCheckSources, runSkillRepos = runCheckSkillRepos, write = (s) => process.stdout.write(s) }) {
  const sources = await capture(runSources, root);
  const repos = await capture(runSkillRepos, root);
  write(sources.text + '\n' + repos.text);

  const runUrl = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  const clean = sources.code === 0 && repos.code === 0;
  const body = [
    'The weekly upstream check has something to review, or could not finish (see the exit codes below). Nothing was changed automatically. For a card source, re-read it, then bump the pin or re-validate the card. For a skill repository, re-read it, then update its pin or delist it.',
    `Run: ${runUrl}`,
    section('Practice-card sources', 'npm run check:sources', sources),
    section('Skill repositories', 'npm run check:skill-repos', repos)
  ].join('\n\n') + '\n';
  const note = clean ? `The check at ${runUrl} found nothing to review.` : `Updated by ${runUrl}.`;

  const result = await syncIssue({ api, title: TITLE, body, clean, note });
  write(`issue: ${result.action}${result.number ? ` #${result.number}` : ''}\n`);
  return 0;
}

const isMain = process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
if (isMain) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const api = createIssuesApi({ token: process.env.GITHUB_TOKEN, repository: process.env.GITHUB_REPOSITORY });
  runUpstreamWatch({ root, api }).then((code) => process.exit(code), (error) => { process.stderr.write(`${error.message}\n`); process.exit(1); });
}
