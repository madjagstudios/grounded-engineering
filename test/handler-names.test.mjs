import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// The desktop Client posts actions by name; one missing from HANDLER_NAMES would be a dead button.
test('HANDLER_NAMES lists exactly the actions register.tsx defines', () => {
  const reg = readFileSync(new URL('../plugin/hooks/register.tsx', import.meta.url), 'utf8');
  const start = reg.indexOf('function actions($: any)');
  const end = reg.indexOf('function handlers($: any)');
  assert.ok(start >= 0 && end > start, 'actions() and handlers() not found in plugin/hooks/register.tsx');
  const defined = [...reg.slice(start, end).matchAll(/^ {4}(\w+): \(/gm)].map((m) => m[1]).sort();
  const scr = readFileSync(new URL('../plugin/hooks/screens.tsx', import.meta.url), 'utf8');
  const from = scr.indexOf('export const HANDLER_NAMES');
  assert.ok(from >= 0, 'HANDLER_NAMES not found in plugin/hooks/screens.tsx');
  const named = [...scr.slice(from, scr.indexOf('] as const', from)).matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
  assert.ok(defined.length >= 10, `only ${defined.length} actions found`);
  assert.deepEqual(named, defined);
});
