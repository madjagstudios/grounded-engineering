import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const bin = join(root, 'bin', 'grounded-engineering.mjs');

test('preview is read-only and reports the baseline plan', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-cli-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Profile: baseline/);
  assert.match(result.stdout, /GE-RC-001/);
  assert.match(result.stdout, /No repository files were changed/);
  assert.equal(existsSync(join(targetRoot, '.grounded-engineering')), false);
  assert.equal(existsSync(join(targetRoot, 'GROUNDED_ENGINEERING.md')), false);
});

test('resolves its own payload when installed under a path containing spaces', () => {
  // Regression: the package root was derived via URL.pathname, which leaves
  // "%20" encoded, so loading packs/ and practices/ failed with ENOENT under
  // a path with spaces (and on Windows). Run the CLI from such a copy.
  const base = mkdtempSync(join(tmpdir(), 'grounded-engineering-space-'));
  const installDir = join(base, 'project with spaces');
  mkdirSync(installDir);
  // Copy the runtime payload and its dependencies so the spaced install is
  // self-contained (bare imports like 'yaml' resolve from node_modules here).
  for (const dir of ['bin', 'src', 'packs', 'practices', 'node_modules']) {
    cpSync(join(root, dir), join(installDir, dir), { recursive: true });
  }
  const spacedBin = join(installDir, 'bin', 'grounded-engineering.mjs');
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-cli-'));

  const result = spawnSync(process.execPath, [spacedBin, 'adopt', 'preview', '--profile', 'baseline'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /GE-RC-001/);
});

test('create saves a proposal but does not write the canonical target', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-cli-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'create', '--profile', 'baseline'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Proposal created: 20[0-9]{6}-[0-9]{6}-[0-9a-f]{8}/);
  assert.equal(existsSync(join(targetRoot, 'GROUNDED_ENGINEERING.md')), false);
  assert.equal(existsSync(join(targetRoot, '.grounded-engineering', 'proposals')), true);
});

test('unsupported fast-follow commands return a documented exit code', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-cli-'));
  const result = spawnSync(process.execPath, [bin, 'check'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /reserved fast-follow command/);
});

test('unknown options fail with usage text', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-cli-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--wat'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown option: --wat/);
  assert.match(result.stderr, /Usage:/);
});

test('non-interactive apply requires explicit confirmation', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-cli-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'apply', '20260826-143000-a1b2c3d4'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--confirm/);
});

test('custom card selection remains preview-only in this release', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-cli-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'create', '--cards', 'GE-RC-001'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /preview only/);
  assert.equal(existsSync(join(targetRoot, '.grounded-engineering')), false);
});
