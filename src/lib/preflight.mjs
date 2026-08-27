import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { walkRepository } from './repository-walk.mjs';

const instructionNames = new Set(['AGENTS.md', 'CLAUDE.md', 'CLAUDE.local.md', 'copilot-instructions.md']);
const packageFiles = new Set(['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml', 'Gemfile']);
const codexOverrideNames = ['AGENTS.override.md'];

function relativePath(root, path) {
  return relative(root, path).split('/').join('/');
}

function readPackageScripts(root) {
  const packagePath = join(root, 'package.json');
  if (!existsSync(packagePath)) return {};
  try {
    return JSON.parse(readFileSync(packagePath, 'utf8')).scripts ?? {};
  } catch {
    return {};
  }
}

export function inspectRepository(root) {
  const files = walkRepository(root);
  const relativeFiles = files.map((file) => relativePath(root, file));
  const instructionFiles = relativeFiles.filter((file) => instructionNames.has(file.split('/').pop()));
  const policyFiles = relativeFiles.filter((file) => file.startsWith('docs/') && file.endsWith('.md'));
  const ciFiles = relativeFiles.filter((file) => file.startsWith('.github/workflows/') && ['.yml', '.yaml'].some((suffix) => file.endsWith(suffix)));
  const projectMarkers = relativeFiles.filter((file) => packageFiles.has(file));
  const manifestPath = '.grounded-engineering/manifest.yaml';

  return {
    root,
    projectMarkers,
    instructionFiles,
    policyFiles,
    ciFiles,
    declaredCommands: readPackageScripts(root),
    manifestExists: existsSync(join(root, manifestPath)),
    proposalDirectoryExists: existsSync(join(root, '.grounded-engineering', 'proposals')),
    hasDocsDirectory: existsSync(join(root, 'docs')) && statSync(join(root, 'docs')).isDirectory(),
  };
}

export function chooseProviderNeutralTarget(report) {
  const path = report.hasDocsDirectory ? 'docs/grounded-engineering.md' : 'GROUNDED_ENGINEERING.md';
  return {
    path,
    reason: report.hasDocsDirectory ? 'docs directory exists' : 'docs directory is absent',
    existing: existsSync(join(report.root, path)),
  };
}

export function chooseCodexTarget(report) {
  const override = codexOverrideNames.find((name) => existsSync(join(report.root, name)));
  if (override) {
    throw new Error(`Codex reads ${override} when present, so it supersedes AGENTS.md and no Codex file was generated. Remove or consolidate ${override}, or target it manually.`);
  }

  const path = 'AGENTS.md';
  return { path, existing: existsSync(join(report.root, path)) };
}

export function chooseClaudeTarget(report) {
  const path = 'CLAUDE.md';
  return { path, existing: existsSync(join(report.root, path)) };
}
