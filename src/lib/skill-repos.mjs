import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';

export const SKILL_REPO_TAGS = Object.freeze(['planning', 'testing', 'review', 'debugging', 'docs', 'frontend', 'typescript', 'python', 'devops', 'security', 'data', 'writing', 'design']);

export function loadSkillRepos(root) {
  const dir = join(root, 'research', 'skill-repos');
  if (!existsSync(dir)) return { records: [], errors: [] };
  const schema = parse(readFileSync(join(root, 'research', 'skill-repo-schema.yaml'), 'utf8'));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  const errors = [];
  const records = [];
  const ids = new Map();
  const repos = new Map();

  for (const name of readdirSync(dir).filter((n) => n.endsWith('.yaml')).sort()) {
    const filePath = join(dir, name);
    const shown = relative(root, filePath);
    let record;
    try { record = parse(readFileSync(filePath, 'utf8')); }
    catch (error) { errors.push(`${shown}: invalid YAML: ${error.message}`); continue; }
    if (!validate(record)) {
      for (const e of validate.errors ?? []) errors.push(`${shown}${e.instancePath || ''}: ${e.message}`);
      continue;
    }
    if (!basename(name).startsWith(`${record.id}-`)) errors.push(`${shown}: file name must start with ${record.id}-`);
    if (ids.has(record.id)) errors.push(`${shown}: duplicate id ${record.id} (also ${ids.get(record.id)})`);
    const repoKey = record.repo.toLowerCase();
    if (repos.has(repoKey)) errors.push(`${shown}: duplicate repo ${record.repo} (also ${repos.get(repoKey)})`);
    ids.set(record.id, shown);
    repos.set(repoKey, shown);
    records.push({ ...record, filePath });
  }

  records.sort((a, b) => a.id.localeCompare(b.id));
  return { records, errors };
}
