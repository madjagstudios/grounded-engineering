import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import { validateManifest } from '../src/lib/manifest.mjs';
import { walkRepository } from '../src/lib/repository-walk.mjs';

const root = new URL('../', import.meta.url).pathname;
const bin = join(root, 'bin', 'grounded-engineering.mjs');

function copyFixture(name) {
  const source = join(root, 'test', 'fixtures', name);
  const target = mkdtempSync(join(tmpdir(), `grounded-engineering-${name}-`));
  cpSync(source, target, { recursive: true });
  return target;
}

function snapshot(directory) {
  return walkRepository(directory)
    .map((path) => [path.slice(directory.length + 1), readFileSync(path, 'utf8')]);
}

function run(targetRoot, ...args) {
  return spawnSync(process.execPath, [bin, ...args], { cwd: targetRoot, encoding: 'utf8' });
}

function proposalId(output) {
  return output.match(/20[0-9]{6}-[0-9]{6}-[0-9a-f]{8}/)?.[0];
}

function reviewProposal(targetRoot, id) {
  const path = join(targetRoot, '.grounded-engineering', 'proposals', id, 'proposal.yaml');
  const proposal = parse(readFileSync(path, 'utf8'));
  proposal.local_decisions = proposal.cards.map((card) => ({
    id: card.id,
    local_applicability: 'APPLICABLE',
    local_decision: 'ACCEPT',
  }));
  writeFileSync(path, stringify(proposal));
}

test('runs preview, create, review, apply, and stable regeneration on a clean fixture', () => {
  const targetRoot = copyFixture('e2e-clean');
  const beforePreview = snapshot(targetRoot);
  const preview = run(targetRoot, 'adopt', 'preview', '--profile', 'baseline');
  assert.equal(preview.status, 0, preview.stderr);
  assert.deepEqual(snapshot(targetRoot), beforePreview);

  const create = run(targetRoot, 'adopt', 'create', '--profile', 'baseline');
  assert.equal(create.status, 0, create.stderr);
  const id = proposalId(create.stdout);
  assert.ok(id);
  reviewProposal(targetRoot, id);

  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 0, apply.stderr);
  assert.equal(existsSync(join(targetRoot, 'GROUNDED_ENGINEERING.md')), true);
  const manifestPath = join(targetRoot, '.grounded-engineering', 'manifest.yaml');
  const manifest = parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(validateManifest(manifest, root).valid, true);

  const currentTarget = readFileSync(join(targetRoot, 'GROUNDED_ENGINEERING.md'), 'utf8');
  const secondCreate = run(targetRoot, 'adopt', 'create', '--profile', 'baseline');
  assert.equal(secondCreate.status, 0, secondCreate.stderr);
  const secondId = proposalId(secondCreate.stdout);
  const secondProposal = parse(readFileSync(join(targetRoot, '.grounded-engineering', 'proposals', secondId, 'proposal.yaml'), 'utf8'));
  assert.equal(secondProposal.targets[0].content, currentTarget);
});

test('generates a separate provider-neutral target beside existing policy surfaces', () => {
  const targetRoot = copyFixture('e2e-existing');
  const originalInstructions = readFileSync(join(targetRoot, 'AGENTS.md'), 'utf8');
  const originalPolicy = readFileSync(join(targetRoot, 'docs', 'engineering.md'), 'utf8');
  const create = run(targetRoot, 'adopt', 'create', '--profile', 'baseline');
  assert.equal(create.status, 0, create.stderr);
  const id = proposalId(create.stdout);
  reviewProposal(targetRoot, id);
  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 0, apply.stderr);
  assert.equal(readFileSync(join(targetRoot, 'AGENTS.md'), 'utf8'), originalInstructions);
  assert.equal(readFileSync(join(targetRoot, 'docs', 'engineering.md'), 'utf8'), originalPolicy);
  assert.equal(existsSync(join(targetRoot, 'docs', 'grounded-engineering.md')), true);
});

test('refuses a stale target with no partial writes', () => {
  const targetRoot = copyFixture('e2e-conflict');
  const originalManifest = join(targetRoot, '.grounded-engineering', 'manifest.yaml');
  const create = run(targetRoot, 'adopt', 'create', '--profile', 'baseline');
  assert.equal(create.status, 0, create.stderr);
  const id = proposalId(create.stdout);
  reviewProposal(targetRoot, id);
  const targetPath = join(targetRoot, 'docs', 'grounded-engineering.md');
  writeFileSync(targetPath, `${readFileSync(targetPath, 'utf8')}\nManual edit after review.\n`);
  const apply = run(targetRoot, 'adopt', 'apply', id, '--confirm');
  assert.equal(apply.status, 2);
  assert.match(apply.stderr, /precondition/);
  assert.equal(existsSync(originalManifest), false);
  assert.match(readFileSync(targetPath, 'utf8'), /Manual edit after review/);
});
