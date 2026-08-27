import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ignoredDirectories = new Set([
  '.git',
  '.grounded-engineering',
  '.private',
  '.superpowers',
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
    // Symlinked directories are intentionally not traversed, preventing cycles and escaping the repository root.
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRepository(path));
    } else if (entry.isFile() || statSync(path).isFile()) {
      files.push(path);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}
