import { readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { parsePracticeFrontmatter } from '../src/lib/frontmatter.mjs';
import { loadPack } from '../src/lib/packs.mjs';
import { walkRepository } from '../src/lib/repository-walk.mjs';
import { getManifestValidator } from '../src/lib/manifest.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const errors = [];

function displayPath(path) {
  return relative(root, path) || '.';
}

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    errors.push(`${displayPath(path)}: ${error.message}`);
    return '';
  }
}

function parseFrontmatter(path, text) {
  try {
    return parsePracticeFrontmatter(path, text).record;
  } catch (error) {
    errors.push(`${displayPath(path)}: ${error.reason ?? error.message.replace(`${path}: `, '')}`);
    return null;
  }
}

function addAjvErrors(path, valid, validate) {
  if (valid) return;
  for (const error of validate.errors ?? []) {
    errors.push(`${displayPath(path)}${error.instancePath || ''}: ${error.message}`);
  }
}

function checkRelativeLinks(path, text) {
  const markdownLink = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of text.matchAll(markdownLink)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, '').split('#', 1)[0];
    if (!rawTarget || /^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;
    const target = resolve(join(path, '..'), rawTarget);
    if (!statExists(target)) errors.push(`${displayPath(path)}: broken relative link ${rawTarget}`);
  }
}

function statExists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function checkPublicText(path, text) {
  const forbidden = [
    /\bTODO\b/i,
    /\bTBD\b/i,
    /\bPLACEHOLDER\b/i,
    /\/Users\//,
    /\/home\//,
    /\bMJS-[0-9]+\b/,
    new RegExp('Mad' + 'JagStudios'),
    new RegExp('studio' + '-ops'),
  ];
  for (const pattern of forbidden) {
    if (pattern.test(text)) errors.push(`${displayPath(path)}: public-content check matched ${pattern}`);
  }
}

const schemaPath = join(root, 'research', 'schema.yaml');
const schema = parse(read(schemaPath));
let validateRecord;
try {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  validateRecord = ajv.compile(schema);
} catch (error) {
  errors.push(`${displayPath(schemaPath)}: invalid JSON Schema: ${error.message}`);
}

if (validateRecord) {
  for (const [index, example] of (schema.examples ?? []).entries()) {
    const valid = validateRecord(example);
    addAjvErrors(`${displayPath(schemaPath)} examples[${index}]`, valid, validateRecord);
  }

  const examplePath = join(root, 'research', 'examples', 'category-disposition-example.yaml');
  const example = parse(read(examplePath));
  const validExample = validateRecord(example);
  addAjvErrors(examplePath, validExample, validateRecord);

  const practiceDirectory = join(root, 'practices');
  for (const path of walkRepository(practiceDirectory).filter((candidate) => candidate.endsWith('.md') && !candidate.endsWith('/README.md'))) {
    const record = parseFrontmatter(path, read(path));
    if (!record) continue;
    const valid = validateRecord(record);
    addAjvErrors(path, valid, validateRecord);

    if (record.disposition === 'DEFER' && record.revisit?.required !== true) {
      errors.push(`${displayPath(path)}: DEFER requires revisit.required: true`);
    }
    if (record.disposition === 'DEFER' && !record.revisit?.trigger) {
      errors.push(`${displayPath(path)}: DEFER requires a revisit trigger`);
    }
    if (record.disposition === 'REJECT' && (record.rationale?.length ?? 0) < 20) {
      errors.push(`${displayPath(path)}: REJECT requires a substantive rationale`);
    }
  }
}

try {
  loadPack(root, 'baseline');
} catch (error) {
  errors.push(`packs/baseline.yaml: ${error.message}`);
}

try {
  getManifestValidator(root);
} catch (error) {
  errors.push(`packs/manifest-schema.yaml: invalid JSON Schema: ${error.message}`);
}

try {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (packageJson.bin?.['grounded-engineering'] !== './bin/grounded-engineering.mjs') {
    errors.push('package.json: grounded-engineering bin entry is missing or incorrect');
  }
  if (!statExists(join(root, 'bin', 'grounded-engineering.mjs'))) {
    errors.push('bin/grounded-engineering.mjs: configured CLI entrypoint does not exist');
  }
} catch (error) {
  errors.push(`package.json: unable to validate CLI entrypoint: ${error.message}`);
}

const sourceTexts = walkRepository(join(root, 'research', 'sources'))
  .filter((path) => path.endsWith('.md'))
  .map((path) => read(path))
  .join('\n');

for (const path of walkRepository(root)) {
  if (path.endsWith('.md')) checkRelativeLinks(path, read(path));
  if (path !== join(root, 'scripts', 'validate.mjs')) checkPublicText(path, read(path));
}

for (const path of walkRepository(join(root, 'practices')).filter((candidate) => candidate.endsWith('.md') && !candidate.endsWith('/README.md'))) {
  const record = parseFrontmatter(path, read(path));
  if (!record) continue;
  for (const sourceId of record.source_ids ?? []) {
    if (!sourceTexts.includes(sourceId)) {
      errors.push(`${displayPath(path)}: source ID ${sourceId} is not defined in research/sources`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Grounded Engineering validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Grounded Engineering validation passed: schema, examples, practice cards, links, provenance IDs, and public-content checks.');
}
