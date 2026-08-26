import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url).pathname;
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
