import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

test('preview accepts the ai-assisted profile', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-cli-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'ai-assisted'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Profile: ai-assisted/);
  assert.match(result.stdout, /GE-AS-001/);
  assert.equal(existsSync(join(targetRoot, '.grounded-engineering')), false);
});

test('create accepts the ai-assisted profile and saves a proposal', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-cli-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'create', '--profile', 'ai-assisted'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Proposal created: 20[0-9]{6}-[0-9]{6}-[0-9a-f]{8}/);
  assert.equal(existsSync(join(targetRoot, 'GROUNDED_ENGINEERING.md')), false);
  assert.equal(existsSync(join(targetRoot, '.grounded-engineering', 'proposals')), true);
});

test('update remains reserved in this release', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-cli-'));
  const result = spawnSync(process.execPath, [bin, 'update'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /reserved fast-follow command/);
});

test('check rejects unknown options with usage text', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'grounded-engineering-cli-'));
  const result = spawnSync(process.execPath, [bin, 'check', '--wat'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown option: --wat/);
  assert.match(result.stderr, /Usage:/);
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

test('preview --adapter codex targets AGENTS.md and writes nothing', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-codex-cli-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'codex'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Adapter: codex/);
  assert.match(result.stdout, /Target: AGENTS\.md/);
  assert.equal(existsSync(join(targetRoot, 'AGENTS.md')), false);
});

test('preview --adapter codex preserves an existing AGENTS.md and only plans a managed block', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-codex-existing-'));
  writeFileSync(join(targetRoot, 'AGENTS.md'), '# My rules\n\nKeep it tidy.\n');
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'codex'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(targetRoot, 'AGENTS.md'), 'utf8'), '# My rules\n\nKeep it tidy.\n');
});

test('preview --adapter claude targets CLAUDE.md and writes nothing', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-claude-cli-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'claude'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Adapter: claude/);
  assert.match(result.stdout, /Target: CLAUDE\.md/);
  assert.equal(existsSync(join(targetRoot, 'CLAUDE.md')), false);
});

test('preview --adapter claude preserves an existing CLAUDE.md and only plans a managed block', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-claude-existing-'));
  writeFileSync(join(targetRoot, 'CLAUDE.md'), '# My Claude rules\n\nKeep this prose.\n');
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'claude'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(targetRoot, 'CLAUDE.md'), 'utf8'), '# My Claude rules\n\nKeep this prose.\n');
});

test('preview --adapter codex fails closed when an override file governs', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-codex-cli-override-'));
  writeFileSync(join(targetRoot, 'AGENTS.override.md'), '# override\n');
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'codex'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /override/i);
});

test('preview fails closed on a malformed managed marker', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-codex-cli-conflict-'));
  writeFileSync(join(targetRoot, 'AGENTS.md'), '<!-- grounded-engineering:begin card=GE-RC-001 -->\nx\n<!-- grounded-engineering:begin card=GE-RC-001 -->\n');
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'codex'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0);
});

test('an unknown --adapter fails closed and lists valid adapters', () => {
  const targetRoot = mkdtempSync(join(tmpdir(), 'ge-adapter-bogus-'));
  const result = spawnSync(process.execPath, [bin, 'adopt', 'preview', '--profile', 'baseline', '--adapter', 'bogus'], {
    cwd: targetRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown adapter: bogus/);
  assert.match(result.stderr, /neutral/);
  assert.match(result.stderr, /claude/);
});

test('help text advertises the v0.4.0 adoption surface', () => {
  const result = spawnSync(process.execPath, [bin, '--help'], {
    cwd: root,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /adopt preview --profile ai-assisted --adapter claude/);
  assert.match(result.stdout, /adopt create --profile ai-assisted --adapter codex/);
  assert.match(result.stdout, /grounded-engineering check/);
  assert.match(result.stdout, /Reserved \(unavailable in v0\.4\.0\):/);
  assert.match(result.stdout, /grounded-engineering update propose --release v0\.4\.0/);
});
