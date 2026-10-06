import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { runValidation } from './validate.mjs';
import { buildCatalog, serializeCatalog } from './lib/catalog.mjs';

export function runBuildCatalog({ root, check = false, write = (s) => process.stdout.write(s) }) {
  const { errors } = runValidation({ root });
  if (errors.length > 0) {
    write(`build:catalog refuses to run — the catalog is not valid (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n`);
    for (const e of errors) write(`- ${e}\n`);
    return 2;
  }
  const path = join(root, 'plugin', 'catalog.json');
  const next = serializeCatalog(buildCatalog(root));
  if (check) {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (current === next) { write('plugin/catalog.json is up to date.\n'); return 0; }
    write('plugin/catalog.json is stale. Run: npm run build:catalog\n');
    return 1;
  }
  writeFileSync(path, next);
  write('Wrote plugin/catalog.json.\n');
  return 0;
}

const isMain = process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
if (isMain) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  process.exitCode = runBuildCatalog({ root, check: process.argv.includes('--check') });
}
