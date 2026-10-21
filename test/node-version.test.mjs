import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');
const pinned = read('.node-version').trim();

test('.node-version pins a Node 24 release at or after the 24.22.1 security fix', () => {
  const [major, minor, patch] = pinned.split('.').map(Number);
  assert.equal(major, 24);
  assert.ok(minor > 22 || (minor === 22 && patch >= 1), `${pinned} predates 24.22.1`);
});

test('every workflow that sets up Node reads .node-version and checks the resolved version', () => {
  for (const file of ['validate.yml', 'upstream-watch.yml']) {
    const steps = Object.values(parse(read('.github', 'workflows', file)).jobs).flatMap((job) => job.steps);
    const setups = steps.filter((s) => s.uses?.startsWith('actions/setup-node@'));
    assert.ok(setups.length > 0, file);
    for (const s of setups) {
      assert.equal(s.with['node-version-file'], '.node-version', file);
      assert.equal(s.with['node-version'], undefined, file);
    }
    assert.ok(steps.some((s) => s.run?.includes('test "$(node --version)" = "v$(cat .node-version)"')), file);
  }
});

test('engines admits only the patched release lines, and the lockfile agrees', () => {
  const range = '^22.23.4 || ^24.22.1 || >=26.12.1';
  assert.equal(JSON.parse(read('package.json')).engines.node, range);
  assert.equal(JSON.parse(read('package-lock.json')).packages[''].engines.node, range);
});
