import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIGNALS } from '../src/lib/signals.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const hooksDir = join(root, 'plugin', 'hooks');

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && name !== 'test-support.ts' ? [path] : [];
  });
}

test('the mod reads exactly the signals the catalog declares', () => {
  const text = readFileSync(join(hooksDir, 'signals.ts'), 'utf8');
  const match = /export const SIGNAL_NAMES = \[([^\]]*)\] as const/.exec(text);
  assert.ok(match, 'SIGNAL_NAMES literal not found in plugin/hooks/signals.ts');
  const names = [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(names, SIGNALS.map((s) => s.name));
});

test('the mod never writes files, runs processes, or uses the network', () => {
  const forbidden = /\$\.(fs\.write|process|http|net|model|tool\.call)\b|\bfetch\s*\(/;
  for (const path of sourceFiles(hooksDir)) {
    assert.ok(!forbidden.test(readFileSync(path, 'utf8')), path);
  }
});

test('links in the mod are built only from https URLs', () => {
  for (const path of sourceFiles(hooksDir)) {
    for (const m of readFileSync(path, 'utf8').matchAll(/href=\{?['"`]([^'"`$]+)/g)) {
      assert.ok(m[1].startsWith('https://'), `${path}: ${m[1]}`);
    }
  }
});

test.skip('marketplace and plugin manifests agree on name and version', { skip: 'version bump lands with the v0.6.0 release (plan 3)' }, () => {
  const market = JSON.parse(readFileSync(join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const plugin = JSON.parse(readFileSync(join(root, 'plugin', '.claude-plugin', 'plugin.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const entry = market.plugins.find((p) => p.name === plugin.name);
  assert.ok(entry);
  assert.equal(entry.source, './plugin');
  assert.equal(entry.version, plugin.version);
  assert.equal(plugin.version, pkg.version);
});
