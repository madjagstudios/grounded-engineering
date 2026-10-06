import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { loadPracticeCards } from './cards.mjs';
import { loadSkillRepos } from './skill-repos.mjs';
import { loadFitRules } from './fit-rules.mjs';
import { SIGNALS } from './signals.mjs';

export const REPOSITORY_URL = 'https://github.com/madjagstudios/grounded-engineering';

export function buildCatalog(root) {
  const { cards, byId } = loadPracticeCards(root);
  const { records } = loadSkillRepos(root);
  const { rules } = loadFitRules(root, new Set(byId.keys()));
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  return {
    catalog_version: 1,
    package_version: version,
    repository: REPOSITORY_URL,
    signals: SIGNALS.map(({ name, type }) => ({ name, type })),
    categories: [...new Set(cards.map((c) => c.category))].sort(),
    practices: cards.map((c) => ({
      id: c.id, title: c.title, category: c.category, subcategory: c.subcategory,
      pattern: c.pattern, rationale: c.rationale, agent_snippet: c.agent_snippet ?? null,
      applicability: c.applicability, control_types: c.control_types, confidence: c.confidence,
      validation_status: c.validation?.status ?? 'not_validated',
      source_ids: c.source_ids, path: relative(root, c.filePath).split(sep).join('/')
    })),
    skill_repos: records.filter((r) => r.status === 'listed').map((r) => ({
      id: r.id, name: r.name, repo: r.repo, license: r.license, pinned_commit: r.pinned_commit,
      reviewed_on: r.reviewed_on, best_for: r.best_for, tags: r.tags, summary: r.summary,
      watch_out_for: r.watch_out_for, install: r.install
    })),
    fit_rules: rules
  };
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
  }
  return value;
}

export function serializeCatalog(catalog) {
  return JSON.stringify(sortKeys(catalog), null, 2) + '\n';
}
