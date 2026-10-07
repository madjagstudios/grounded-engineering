import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const ignoredDirectories = new Set([
  '.git',
  '.grounded-engineering',
  '.private',
  '.worktrees',
  'coverage',
  'dist',
  'node_modules',
  'reports',
  'worktrees'
]);

export function walkRepository(directory) {
  const entries = readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  const files = [];
  for (const entry of entries) {
    // Symlinks are not followed: a symlinked file or directory is skipped.
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    // Claude Code writes plugin/.claude-plugin/types/ when it loads the plugin; it is gitignored, so skip it.
    if (entry.isDirectory() && entry.name === 'types' && basename(directory) === '.claude-plugin') continue;

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRepository(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}
