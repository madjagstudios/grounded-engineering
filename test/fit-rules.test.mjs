import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFitRules } from '../src/lib/fit-rules.mjs';
import { SIGNALS, BOOLEAN_SIGNALS } from '../src/lib/signals.mjs';
import { loadPracticeCards } from '../src/lib/cards.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const ids = new Set(['GE-VF-001', 'GE-TS-001']);
const withRules = (text) => {
  const root = mkdtempSync(join(tmpdir(), 'ge-fit-'));
  mkdirSync(join(root, 'plugin'));
  writeFileSync(join(root, 'plugin', 'fit-rules.yaml'), text);
  return root;
};

test('signal names are unique snake_case', () => {
  const names = SIGNALS.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
  for (const n of names) assert.match(n, /^[a-z][a-z0-9_]*$/);
  assert.ok(BOOLEAN_SIGNALS.has('has_ci'));
  assert.ok(!BOOLEAN_SIGNALS.has('languages'));
});

test('a valid rule loads with normalized when', () => {
  const { rules, errors } = loadFitRules(withRules('- card: GE-VF-001\n  when: { all: [has_tests], none: [has_ci] }\n  why: Tests exist, but no CI gate runs them.\n'), ids);
  assert.deepEqual(errors, []);
  assert.deepEqual(rules, [{ card: 'GE-VF-001', when: { all: ['has_tests'], any: [], none: ['has_ci'] }, why: 'Tests exist, but no CI gate runs them.' }]);
});

test('unknown card, unknown signal, non-boolean signal, empty when, and bad why are rejected', () => {
  const text = [
    '- card: GE-XX-999\n  when: { all: [has_ci] }\n  why: Unknown card rule text.',
    '- card: GE-VF-001\n  when: { all: [has_magic] }\n  why: Unknown signal rule text.',
    '- card: GE-VF-001\n  when: { all: [languages] }\n  why: Non-boolean signal rule.',
    '- card: GE-TS-001\n  when: {}\n  why: Empty condition rule text.',
    '- card: GE-TS-001\n  when: { none: [has_tests] }\n  why: short'
  ].join('\n') + '\n';
  const { errors } = loadFitRules(withRules(text), ids);
  assert.ok(errors.some((e) => /rules\[0\].*unknown card GE-XX-999/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /rules\[1\].*unknown signal has_magic/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /rules\[2\].*languages is not a boolean signal/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /rules\[3\].*at least one condition/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /rules\[4\].*why must be 10-100 characters/.test(e)), errors.join('\n'));
});

test('missing rules file is not an error', () => {
  assert.deepEqual(loadFitRules(mkdtempSync(join(tmpdir(), 'ge-fit-none-')), ids), { rules: [], errors: [] });
});

test('the shipped rules are valid against the real cards', () => {
  const { byId } = loadPracticeCards(repoRoot);
  const { rules, errors } = loadFitRules(repoRoot, new Set(byId.keys()));
  assert.deepEqual(errors, []);
  assert.ok(rules.length >= 6);
});
