import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import parseSpdx from 'spdx-expression-parse';
// The package's own tokenizer, at the version pinned in package.json.
import scanSpdx from 'spdx-expression-parse/scan.js';

// Canonical SPDX only. The parser tolerates mixed-case operators and missing or
// extra spaces, so rebuild the expression from its tokens in canonical form and
// require an exact match before parsing it.
const SPACING_EXEMPT = new Set([')', ':', '+']);
const PREFIX = { LICENSEREF: 'LicenseRef-', DOCUMENTREF: 'DocumentRef-' };

function canonicalSpdx(tokens) {
  let out = '';
  let previous = null;
  for (const token of tokens) {
    const text = (PREFIX[token.type] ?? '') + token.string;
    const joined = previous === null || SPACING_EXEMPT.has(token.string) || previous === '(' || previous === ':';
    out += (joined ? '' : ' ') + text;
    previous = token.string;
  }
  return out;
}

export function isValidSpdxLicense(license) {
  if (typeof license !== 'string') return false;
  try {
    if (canonicalSpdx(scanSpdx(license)) !== license) return false;
    parseSpdx(license);
    return true;
  } catch {
    return false;
  }
}

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
    // The schema only requires a string; the SPDX license and exception lists
    // decide whether a listed record's license is a valid expression.
    if (record.status === 'listed' && !isValidSpdxLicense(record.license)) {
      errors.push(`${shown}/license: not a valid SPDX license expression: ${record.license}`);
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
