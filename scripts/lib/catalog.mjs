import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { loadPracticeCards } from '../../src/lib/cards.mjs';
import { loadSkillRepos } from '../../src/lib/skill-repos.mjs';
import { loadFitRules } from '../../src/lib/fit-rules.mjs';
import { SIGNALS } from '../../src/lib/signals.mjs';
import { buildSourceRegistry, extractDestinations } from './source-registry.mjs';

// plugin/catalog.json is versioned by catalog_version. Within a version, fields are
// only added, never removed or renamed. The plugin reads this file and nothing else.

export const REPOSITORY_URL = 'https://github.com/madjagstudios/grounded-engineering';

function evidenceSources(root, practices) {
  const { registry } = buildSourceRegistry(join(root, 'research', 'sources'));
  const ids = [...new Set(practices.flatMap((p) => p.source_ids))].sort();
  return ids.map((id) => {
    const url = extractDestinations(registry.get(id)?.sourceField ?? '').dests[0];
    if (!url) throw new Error(`catalog: source ${id} has no URL in the source registry`);
    return { id, url };
  });
}

export function buildCatalog(root) {
  const { cards, byId } = loadPracticeCards(root);
  const { records } = loadSkillRepos(root);
  const { rules } = loadFitRules(root, new Set(byId.keys()));
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  const practices = cards.map((c) => ({
    id: c.id, title: c.title, category: c.category, subcategory: c.subcategory,
    pattern: c.pattern, rationale: c.rationale, agent_snippet: c.agent_snippet ?? null,
    applicability: c.applicability, control_types: c.control_types, confidence: c.confidence,
    validation_status: c.validation?.status ?? 'not_validated',
    source_ids: c.source_ids, path: relative(root, c.filePath).split(sep).join('/'),
    body: c.body.replace(/^\s*# [^\n]*\n+/, '').trim()
  }));

  return {
    catalog_version: 1,
    package_version: version,
    repository: REPOSITORY_URL,
    signals: SIGNALS.map(({ name, type, description }) => ({ name, type, description })),
    categories: [...new Set(cards.map((c) => c.category))].sort(),
    practices,
    sources: evidenceSources(root, practices),
    skill_repos: records.filter((r) => r.status === 'listed').map((r) => ({
      id: r.id, name: r.name, repo: r.repo, license: r.license, pinned_commit: r.pinned_commit,
      reviewed_on: r.reviewed_on, best_for: r.best_for, tags: r.tags, summary: r.summary,
      watch_out_for: r.watch_out_for, install: r.install, install_note: r.install_note
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
