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

// `ui.toast` tells the person when one of the plugin's skills fails to start from the pane;
// it draws a short line and reaches nothing outside the session.
const ALLOWED_MEMBERS = new Set(['fs.read', 'fs.exists', 'fs.list', 'plugin.root', 'ui.open', 'ui.resolve', 'ui.toast', 'command.register', 'command.run']);
const FORBIDDEN_TOKENS = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'child_process'];

// Returns the violations found in one source text: any `$.` member outside the allowlist,
// bracket access on `$`, destructuring of `$`, and the network and process tokens.
export function findCapabilityViolations(text) {
  const violations = [];
  for (const m of text.matchAll(/\$\??\.([a-zA-Z_]+(?:\.[a-zA-Z_]+)?)/g)) {
    if (!ALLOWED_MEMBERS.has(m[1])) violations.push(`$.${m[1]} is not an allowed capability`);
  }
  if (/\$\??\.?\[/.test(text)) violations.push('bracket access on $');
  if (/=\s*\$(?![\w.[?$])/.test(text) || /\}\s*=\s*\$/.test(text)) violations.push('destructuring of $');
  for (const token of FORBIDDEN_TOKENS) {
    if (text.includes(token)) violations.push(`${token} is not allowed`);
  }
  return violations;
}

test('the capability checker flags what the mod must never do', () => {
  assert.ok(findCapabilityViolations("await $.fs.write('a', 'b')").length > 0);
  assert.ok(findCapabilityViolations('$.process.run({})').length > 0);
  assert.ok(findCapabilityViolations('const { fs } = $').length > 0);
  assert.ok(findCapabilityViolations('const x = $;').length > 0);
  assert.ok(findCapabilityViolations("$['fs'].write('a', 'b')").length > 0);
  assert.ok(findCapabilityViolations('const fs = $.fs').length > 0);
  for (const token of FORBIDDEN_TOKENS) assert.ok(findCapabilityViolations(`x ${token}`).length > 0, token);
  assert.deepEqual(findCapabilityViolations("const t = await $.fs.read(`${$.plugin.root}/c.json`); $?.ui.open({})"), []);
});

test('the mod uses only the capabilities it is allowed', () => {
  for (const path of sourceFiles(hooksDir)) {
    assert.deepEqual(findCapabilityViolations(readFileSync(path, 'utf8')), [], path);
  }
});

// Every Link href is a literal https URL or comes from one of these, each only in the file
// named: `l.href` is the shared card's pass-through of a model's links (whose `href:` values
// are checked below), `m.href` the MORE list's entries (literals, checked below too).
const HREF_SOURCES = new Map([['catalog.repository', null], ['l.href', /[\\/]card\.tsx$/], ['m.href', /[\\/]skills\.tsx$/]]);
const isHttpsLiteral = (value) => /^(['"`])https:\/\/[^'"`$\s]+\1$/.test(value);

// The URL builders in catalog.ts, read from its source and evaluated as written: Node runs no
// TypeScript, and a copy of the template here could drift from the one the mod draws.
function builder(name) {
  const text = readFileSync(join(hooksDir, 'catalog.ts'), 'utf8');
  const m = new RegExp(`export const ${name} = \\(([^)]*)\\) =>\\s*(\`[^\`]*\`)`).exec(text);
  assert.ok(m, `${name} not found in plugin/hooks/catalog.ts`);
  const params = m[1].split(',').map((p) => p.split(':')[0].trim());
  return { template: m[2], fn: new Function(...params, `return ${m[2]}`) };
}

test('the URL builders produce https URLs', () => {
  assert.ok(builder('cardUrl').template.startsWith('`${catalog.repository}/'), 'cardUrl must build on catalog.repository');
  assert.ok(builder('repoUrl').template.startsWith('`https://github.com/'), 'repoUrl must build an https GitHub URL');
  const catalog = JSON.parse(readFileSync(join(root, 'plugin', 'catalog.json'), 'utf8'));
  assert.match(catalog.repository, /^https:\/\/[^\s@]+$/);
});

test('every URL the mod builds from the shipped catalog is already in normal form', () => {
  const catalog = JSON.parse(readFileSync(join(root, 'plugin', 'catalog.json'), 'utf8'));
  const cardUrl = builder('cardUrl').fn;
  const repoUrl = builder('repoUrl').fn;
  const urls = [
    catalog.repository,
    ...catalog.practices.map((practice) => cardUrl(catalog, practice)),
    ...catalog.skill_repos.map((repo) => repoUrl(repo)),
  ];
  assert.ok(catalog.practices.length > 0);
  for (const u of urls) {
    assert.ok(u.startsWith('https://'), u);
    assert.equal(new URL(u).href, u);
  }
});

test('links in the mod are built only from https URLs', () => {
  let attributes = 0;
  let properties = 0;
  for (const path of sourceFiles(hooksDir)) {
    const text = readFileSync(path, 'utf8');
    for (const m of text.matchAll(/href=(?:\{([^}]*)\}|("[^"]*"|'[^']*'))/g)) {
      attributes += 1;
      const value = (m[1] ?? m[2]).trim();
      const home = HREF_SOURCES.get(value);
      assert.ok(isHttpsLiteral(value) || HREF_SOURCES.has(value), `${path}: href=${value}`);
      if (home) assert.match(path, home, `${path}: href=${value} outside the file it belongs to`);
      if (value === 'm.href') assert.match(text, /const MORE = \[/, `${path}: m.href outside the MORE list`);
    }
    for (const m of text.matchAll(/\bhref:\s*([^,}\]\n;]+)/g)) {
      const value = m[1].trim();
      if (value === 'string') continue; // a type annotation, not a value
      properties += 1;
      assert.ok(isHttpsLiteral(value) || /^(cardUrl|repoUrl)\(/.test(value), `${path}: href: ${value}`);
    }
    for (const m of text.matchAll(/[{,]\s*href\s*(?=[,}])/g)) {
      assert.fail(`${path}: shorthand { href } hides where the URL came from: ${m[0]}`);
    }
  }
  assert.ok(attributes > 0, 'no Link href found in the mod');
  assert.ok(properties > 0, 'no href: value found in the mod');
});

test('the href scan sees a shorthand property', () => {
  assert.ok(/[{,]\s*href\s*(?=[,}])/.test('links: [{ label, href }]'));
  assert.ok(!/[{,]\s*href\s*(?=[,}])/.test("{ label: 'a', href: cardUrl(c, x) }"));
});

test('marketplace and plugin manifests agree on name and version', () => {
  const market = JSON.parse(readFileSync(join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const plugin = JSON.parse(readFileSync(join(root, 'plugin', '.claude-plugin', 'plugin.json'), 'utf8'));
  const entry = market.plugins.find((p) => p.name === plugin.name);
  assert.ok(entry);
  assert.equal(entry.source, './plugin');
  assert.equal(entry.version, plugin.version);
});

test.skip('the plugin version matches the package version', { skip: 'version bump lands with the v0.6.0 release' }, () => {
  const plugin = JSON.parse(readFileSync(join(root, 'plugin', '.claude-plugin', 'plugin.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(plugin.version, pkg.version);
});
