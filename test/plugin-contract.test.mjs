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

test('the plugin reads exactly the signals the catalog declares', () => {
  const text = readFileSync(join(hooksDir, 'signals.ts'), 'utf8');
  const match = /export const SIGNAL_NAMES = \[([^\]]*)\] as const/.exec(text);
  assert.ok(match, 'SIGNAL_NAMES literal not found in plugin/hooks/signals.ts');
  const names = [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(names, SIGNALS.map((s) => s.name));
});

// What the plugin may do: read files, open and draw its pane, register and run its own
// commands, show a toast. This is a quick local check. CI's scripts/check-plugin-calls.mjs
// gate, which reads the engine's own report of the plugin's calls, is the authoritative one.
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

test('the capability checker flags what the plugin must never do', () => {
  assert.ok(findCapabilityViolations("await $.fs.write('a', 'b')").length > 0);
  assert.ok(findCapabilityViolations('$.process.run({})').length > 0);
  assert.ok(findCapabilityViolations('const { fs } = $').length > 0);
  assert.ok(findCapabilityViolations('const x = $;').length > 0);
  assert.ok(findCapabilityViolations("$['fs'].write('a', 'b')").length > 0);
  assert.ok(findCapabilityViolations('const fs = $.fs').length > 0);
  for (const token of FORBIDDEN_TOKENS) assert.ok(findCapabilityViolations(`x ${token}`).length > 0, token);
  assert.deepEqual(findCapabilityViolations("const t = await $.fs.read(`${$.plugin.root}/c.json`); $?.ui.open({})"), []);
});

test('the plugin uses only the capabilities it is allowed', () => {
  for (const path of sourceFiles(hooksDir)) {
    assert.deepEqual(findCapabilityViolations(readFileSync(path, 'utf8')), [], path);
  }
});

// The URL builders in catalog.ts, read from its source and evaluated as written: Node runs no
// TypeScript, and a copy of the template here could drift from the one the plugin draws.
function builder(name) {
  const text = readFileSync(join(hooksDir, 'catalog.ts'), 'utf8');
  const m = new RegExp(`export const ${name} = \\(([^)]*)\\) =>\\s*(\`[^\`]*\`)`).exec(text);
  assert.ok(m, `${name} not found in plugin/hooks/catalog.ts`);
  const params = m[1].split(',').map((p) => p.split(':')[0].trim());
  return new Function(...params, `return ${m[2]}`);
}

test('every URL the plugin builds from the shipped catalog is https and in normal form', () => {
  const catalog = JSON.parse(readFileSync(join(root, 'plugin', 'catalog.json'), 'utf8'));
  const cardUrl = builder('cardUrl');
  const repoUrl = builder('repoUrl');
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

// A Link opens the viewer's browser, so every href must come from a vetted https URL.
const VETTED_HREF = /^(?:(['"`])https:\/\/[^'"`$\s]+\1$|(?:cardUrl|repoUrl)\(|(?:c\.repository|l\.href)$)/;

test('every href in the pane is an https literal or a vetted URL', () => {
  let checked = 0;
  let inScreens = 0;
  for (const path of sourceFiles(hooksDir).filter((p) => p.endsWith('.tsx'))) {
    const text = readFileSync(path, 'utf8');
    for (const m of text.matchAll(/\bhref(?:=\{([^}]*)\}|=("[^"]*"|'[^']*')|:\s*([^,}\]\n;]+))/g)) {
      const value = (m[1] ?? m[2] ?? m[3]).trim();
      checked += 1;
      if (path.endsWith('screens.tsx')) inScreens += 1;
      assert.match(value, VETTED_HREF, `${path}: href ${value}`);
    }
  }
  assert.ok(checked > 0, 'no href found in the pane sources');
  // The shared screens hold every link: the repository, cards, skill repos and the MORE list.
  assert.ok(inScreens >= 6, `only ${inScreens} hrefs found in screens.tsx`);
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

test('the shipped catalog gives the explain skill literal install steps and a separate note', async () => {
  const catalog = JSON.parse(readFileSync(join(root, 'plugin', 'catalog.json'), 'utf8'));
  for (const r of catalog.skill_repos) {
    assert.ok(Array.isArray(r.install), r.id);
    assert.ok(r.install_note === null || typeof r.install_note === 'string', r.id);
  }
  const skill = readFileSync(join(root, 'plugin', 'skills', 'explain', 'SKILL.md'), 'utf8');
  assert.match(skill, /`install_note`[^\n]*never something to run/);
  assert.match(skill, /in order/);
  assert.match(skill, /Stop at the first step that fails/);
});
