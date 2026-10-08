import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const text = readFileSync(join(root, '.github', 'workflows', 'upstream-watch.yml'), 'utf8');
const workflow = parse(text);

test('the upstream watch has one schedule and a manual trigger, and no other triggers', () => {
  assert.deepEqual(Object.keys(workflow.on).sort(), ['schedule', 'workflow_dispatch']);
  assert.equal(workflow.on.schedule.length, 1);
});

test('the upstream watch can read the code and write issues, nothing more', () => {
  assert.deepEqual(workflow.permissions, { contents: 'read', issues: 'write' });
  for (const job of Object.values(workflow.jobs)) assert.equal(job.permissions, undefined);
});

test('the upstream watch uses only the built-in token', () => {
  assert.doesNotMatch(text, /secrets\./);
  const step = workflow.jobs.watch.steps.find((s) => s.run === 'node scripts/upstream-watch.mjs');
  assert.deepEqual(step.env, { GITHUB_TOKEN: '${{ github.token }}' });
});
