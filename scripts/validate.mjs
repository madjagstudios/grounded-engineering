import { readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { parsePracticeFrontmatter } from '../src/lib/frontmatter.mjs';
import { loadPack } from '../src/lib/packs.mjs';
import { walkRepository } from '../src/lib/repository-walk.mjs';
import { getManifestValidator } from '../src/lib/manifest.mjs';
import { buildSourceRegistry, validateCardSourceReferences, validateCardValidationProvenance } from './lib/source-registry.mjs';

function statExists(path) {
  try { statSync(path); return true; } catch { return false; }
}

export function runValidation({ root }) {
  const validationRoot = resolve(root);
  const errors = [];
  const displayPath = (path) => relative(validationRoot, path) || '.';
  const read = (path) => {
    try { return readFileSync(path, 'utf8'); }
    catch (error) { errors.push(`${displayPath(path)}: ${error.message}`); return ''; }
  };
  const parseFrontmatter = (path, text) => {
    try { return parsePracticeFrontmatter(path, text).record; }
    catch (error) { errors.push(`${displayPath(path)}: ${error.reason ?? error.message.replace(`${path}: `, '')}`); return null; }
  };
  const addAjvErrors = (path, valid, validate) => {
    if (valid) return;
    for (const error of validate.errors ?? []) errors.push(`${displayPath(path)}${error.instancePath || ''}: ${error.message}`);
  };
  const checkRelativeLinks = (path, text) => {
    const markdownLink = /\[[^\]]+\]\(([^)]+)\)/g;
    for (const match of text.matchAll(markdownLink)) {
      const rawTarget = match[1].trim().replace(/^<|>$/g, '').split('#', 1)[0];
      if (!rawTarget || /^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;
      const target = resolve(join(path, '..'), rawTarget);
      if (!statExists(target)) errors.push(`${displayPath(path)}: broken relative link ${rawTarget}`);
    }
  };
  const checkPublicText = (path, text) => {
    const forbidden = [
      /\bTODO\b/i, /\bTBD\b/i, /\bPLACEHOLDER\b/i, /\/Users\//, /\/home\//, /\bMJS-[0-9]+\b/,
      new RegExp('Mad' + 'JagStudios'), /studio-ops/i, /MADJAG_STUDIO_OPS/i, /PUBLIC_ALLOWLIST/i,
      /private (?:studio operations|publication|scanner)/i, /(?:\.git\/hooks\/commit-msg|\.githooks\/)/i,
      /(?:docs\/)?superpowers\//i, /superpowers:/i, /REQUIRED SUB-SKILL/i
    ];
    for (const pattern of forbidden) if (pattern.test(text)) errors.push(`${displayPath(path)}: public-content check matched ${pattern}`);
  };

  const schemaPath = join(validationRoot, 'research', 'schema.yaml');
  const schema = parse(read(schemaPath));
  let validateRecord;
  try { validateRecord = new Ajv2020({ allErrors: true, strict: false }).compile(schema); }
  catch (error) { errors.push(`${displayPath(schemaPath)}: invalid JSON Schema: ${error.message}`); }

  const validCards = [];
  if (validateRecord) {
    for (const [index, example] of (schema.examples ?? []).entries()) {
      addAjvErrors(`${displayPath(schemaPath)} examples[${index}]`, validateRecord(example), validateRecord);
    }
    const examplePath = join(validationRoot, 'research', 'examples', 'category-disposition-example.yaml');
    addAjvErrors(examplePath, validateRecord(parse(read(examplePath))), validateRecord);

    for (const path of walkRepository(join(validationRoot, 'practices')).filter((c) => c.endsWith('.md') && !c.endsWith('/README.md'))) {
      const record = parseFrontmatter(path, read(path));
      if (!record) continue;
      const valid = validateRecord(record);
      addAjvErrors(path, valid, validateRecord);
      if (valid) validCards.push({ record, filePath: path });
      if (record.disposition === 'DEFER' && record.revisit?.required !== true) errors.push(`${displayPath(path)}: DEFER requires revisit.required: true`);
      if (record.disposition === 'DEFER' && !record.revisit?.trigger) errors.push(`${displayPath(path)}: DEFER requires a revisit trigger`);
      if (record.disposition === 'REJECT' && (record.rationale?.length ?? 0) < 20) errors.push(`${displayPath(path)}: REJECT requires a substantive rationale`);
    }
  }

  try { loadPack(validationRoot, 'baseline'); } catch (error) { errors.push(`packs/baseline.yaml: ${error.message}`); }
  try { loadPack(validationRoot, 'ai-assisted'); } catch (error) { errors.push(`packs/ai-assisted.yaml: ${error.message}`); }
  try { getManifestValidator(validationRoot); } catch (error) { errors.push(`packs/manifest-schema.yaml: invalid JSON Schema: ${error.message}`); }

  try {
    const packageJson = JSON.parse(readFileSync(join(validationRoot, 'package.json'), 'utf8'));
    if (packageJson.bin?.['grounded-engineering'] !== 'bin/grounded-engineering.mjs') errors.push('package.json: grounded-engineering bin entry is missing or incorrect');
    if (!statExists(join(validationRoot, 'bin', 'grounded-engineering.mjs'))) errors.push('bin/grounded-engineering.mjs: configured CLI entrypoint does not exist');
  } catch (error) { errors.push(`package.json: unable to validate CLI entrypoint: ${error.message}`); }

  const readmeText = read(join(validationRoot, 'README.md'));
  for (const snippet of ['npx grounded-engineering adopt preview --profile ai-assisted --adapter claude', 'grounded-engineering check', 'v0.2.0', 'does not rewrite existing policy']) {
    if (!readmeText.includes(snippet)) errors.push(`README.md: missing required public release text: ${snippet}`);
  }

  const selfPath = join(validationRoot, 'scripts', 'validate.mjs');
  for (const path of walkRepository(validationRoot)) {
    if (path === join(validationRoot, '.git')) continue;
    if (path.endsWith('.md')) checkRelativeLinks(path, read(path));
    if (path !== selfPath) checkPublicText(path, read(path));
  }

  const { registry, errors: registryErrors } = buildSourceRegistry(join(validationRoot, 'research', 'sources'));
  for (const d of registryErrors) errors.push(`${displayPath(d.filePath)}${d.line ? `:${d.line}` : ''}: ${d.message}`);
  if (registryErrors.length === 0) {
    for (const d of validateCardSourceReferences(validCards, registry)) errors.push(`${displayPath(d.filePath)}: ${d.message}`);
    for (const d of validateCardValidationProvenance(validCards, registry)) errors.push(`${displayPath(d.filePath)}: ${d.message}`);
  }

  return { errors };
}

const isMain = process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
if (isMain) {
  const { errors } = runValidation({ root: resolve(fileURLToPath(new URL('..', import.meta.url))) });
  if (errors.length > 0) {
    console.error(`Grounded Engineering validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('Grounded Engineering validation passed: schema, examples, practice cards, links, provenance IDs, and public-content checks.');
  }
}
