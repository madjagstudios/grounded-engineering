import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const bin = join(root, 'bin', 'grounded-engineering.mjs');
const policyPath = join(root, 'policies', 'adopt-apply.md');
const applyCommand = 'grounded-engineering adopt apply <proposal-id> --confirm';

test('the documented apply policy is advertised by the real CLI and shipped in the npm package', () => {
  const help = spawnSync(process.execPath, [bin, '--help'], {
    cwd: root,
    encoding: 'utf8'
  });

  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, new RegExp(applyCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(help.stdout, /policies\/adopt-apply\.md/);

  const policy = readFileSync(policyPath, 'utf8');
  assert.match(policy, new RegExp(applyCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(policy, /does not depend on or endorse any third-party wrapper/);

  const packed = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8'
  });

  assert.equal(packed.status, 0, packed.stderr);
  const files = JSON.parse(packed.stdout)[0].files.map(({ path }) => path);
  assert.ok(files.includes('policies/adopt-apply.md'), `package files:\n${files.join('\n')}`);
});
