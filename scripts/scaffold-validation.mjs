import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import process from 'node:process';
import { loadPracticeCards, resolveCardReference } from '../src/lib/cards.mjs';
import { buildSourceRegistry } from './lib/source-registry.mjs';
import { buildValidationEntries, renderValidationEntries, validationEntriesMatch } from './lib/validation-scaffold.mjs';
import { runValidation } from './validate.mjs';

const usage = `Usage:
  npm run scaffold:validation -- <card-id-or-path>
  npm run scaffold:validation -- <card-id-or-path> --check
`;

export function parseArgs(args) {
  let check = false;
  let reference = null;
  for (const argument of args) {
    if (argument === '--help') return { help: true };
    if (argument === '--check') {
      if (check) throw new Error('Duplicate --check flag');
      check = true;
      continue;
    }
    if (reference) throw new Error(`Unexpected argument: ${argument}`);
    reference = argument;
  }
  if (!reference) throw new Error('A practice card ID or path is required');
  return { check, reference };
}

function resolveCard(root, reference, index) {
  if (!reference.endsWith('.md') && !reference.includes('/') && !reference.includes('\\')) {
    return resolveCardReference(reference, index);
  }
  const path = resolve(root, reference);
  const card = index.cards.find((candidate) => resolve(candidate.filePath) === path);
  if (!card) throw new Error(`Unknown practice card path: ${reference}`);
  return card;
}

export function runScaffold({ root, args, write = (message) => process.stdout.write(`${message}\n`), error = (message) => process.stderr.write(`${message}\n`) }) {
  let options;
  try {
    options = parseArgs(args);
    if (options.help) {
      write(usage.trimEnd());
      return 0;
    }
  } catch (caught) {
    error(`${caught.message}\n${usage.trimEnd()}`);
    return 2;
  }

  const validation = runValidation({ root });
  if (validation.errors.length > 0) {
    error(`scaffold:validation refuses to run — the catalog is not valid (${validation.errors.length} issue${validation.errors.length === 1 ? '' : 's'}):`);
    for (const validationError of validation.errors) error(`- ${validationError}`);
    return 2;
  }

  const { registry, errors } = buildSourceRegistry(join(root, 'research', 'sources'));
  if (errors.length > 0) {
    error('scaffold:validation refuses to run — the source registry is not valid:');
    for (const diagnostic of errors) error(`- ${diagnostic.message}`);
    return 2;
  }

  try {
    const index = loadPracticeCards(root);
    const card = resolveCard(root, options.reference, index);
    const expected = buildValidationEntries(card, registry);
    if (options.check) {
      const current = card.validation?.validated_against;
      if (validationEntriesMatch(current, expected)) {
        write(`Validation provenance is current: ${card.id}`);
        return 0;
      }
      write(`Validation provenance is stale or missing: ${card.id}`);
      return 1;
    }
    write(renderValidationEntries(expected).trimEnd());
    return 0;
  } catch (caught) {
    error(`${caught.message}\n${usage.trimEnd()}`);
    return 2;
  }
}

const isMain = process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
if (isMain) process.exitCode = runScaffold({ root: resolve(fileURLToPath(new URL('..', import.meta.url))), args: process.argv.slice(2) });
