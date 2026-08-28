import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, realpathSync } from 'node:fs';
import process from 'node:process';
import { runValidation } from './validate.mjs';
import { buildSourceRegistry } from './lib/source-registry.mjs';
import { walkRepository } from '../src/lib/repository-walk.mjs';
import { parsePracticeFrontmatter } from '../src/lib/frontmatter.mjs';
import { createGithubClient } from './lib/github.mjs';
import { detectDrift } from './lib/drift.mjs';

function defaultLoadCards(root) {
  return walkRepository(join(root, 'practices'))
    .filter((p) => p.endsWith('.md') && !p.endsWith('/README.md'))
    .map((p) => { try { return parsePracticeFrontmatter(p, readFileSync(p, 'utf8')).record; } catch { return null; } })
    .filter(Boolean)
    .map((r) => ({ id: r.id, source_ids: r.source_ids, validation: r.validation }));
}

function renderText({ headline, sources, summary }) {
  const lines = [`check:sources — ${headline}`, ''];
  for (const s of sources) {
    lines.push(s.kind === 'doc' ? `${s.source_id}: N/A doc — manual re-audit` : `${s.source_id}: ${s.status}${s.reason ? ` (${s.reason})` : ''}`);
    if (s.status === 'DRIFTED') for (const c of s.cards) lines.push(`    - ${c.id} [${c.validated ? 'validated — needs review' : 'not validated'}]`);
  }
  lines.push('', `sources: ${summary.commitSources} commit / ${summary.docSources} doc | targets ${summary.distinctTargetCount} distinct of ${summary.rawTargetCount} | ok ${summary.ok} drifted ${summary.drifted} errored ${summary.errored} | zero-card ${summary.sourcesWithZeroCards} | network calls ${summary.networkCalls}`);
  return lines.join('\n') + '\n';
}

export async function runCheckSources({
  root,
  validate = runValidation,
  buildRegistry = (r) => buildSourceRegistry(join(r, 'research', 'sources')),
  loadCards = defaultLoadCards,
  createClient = createGithubClient,
  client,
  format = 'text',
  write = (s) => process.stdout.write(s)
}) {
  const { errors } = validate({ root });
  if (errors.length > 0) {
    write(`check:sources refuses to run — the catalog is not valid (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n`);
    for (const e of errors) write(`- ${e}\n`);
    return 2;
  }
  const { registry, errors: regErrors } = buildRegistry(root);
  if (regErrors.length > 0) { for (const d of regErrors) write(`- ${d.message ?? d}\n`); return 2; }
  const cards = loadCards(root);
  const gh = client ?? createClient(); // constructed ONLY after the gate
  const out = await detectDrift({ registry, cards, client: gh });
  write(format === 'json'
    ? JSON.stringify({ version: 1, repoHeads: out.repoHeads, sources: out.sources, summary: out.summary }, null, 2) + '\n'
    : renderText(out));
  return out.exitCode;
}

const isMain = process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
if (isMain) {
  const format = process.argv.includes('--json') ? 'json' : 'text';
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  runCheckSources({ root, format }).then((code) => process.exit(code));
}
