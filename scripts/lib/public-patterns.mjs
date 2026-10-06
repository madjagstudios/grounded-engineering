import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Text that should never appear in the public tree, for any maintainer.
export const GENERIC_PUBLIC_PATTERNS = Object.freeze([
  /\bTODO\b/i, /\bTBD\b/i, /\bPLACEHOLDER\b/i, /\/Users\//, /\/home\//
]);

export const LOCAL_PATTERNS_PATH = '.private/public-content-patterns.txt';

// A maintainer can add their own patterns in an untracked file: one per line,
// written as /source/flags or as a case-sensitive source; # starts a comment.
export function loadLocalPublicPatterns(root) {
  const path = join(root, LOCAL_PATTERNS_PATH);
  if (!existsSync(path)) return { patterns: [], errors: [] };
  const patterns = [];
  const errors = [];
  readFileSync(path, 'utf8').split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const literal = /^\/(.+)\/([a-z]*)$/.exec(line);
    try { patterns.push(literal ? new RegExp(literal[1], literal[2]) : new RegExp(line)); }
    catch (error) { errors.push(`${LOCAL_PATTERNS_PATH}:${index + 1}: invalid pattern: ${error.message}`); }
  });
  return { patterns, errors };
}
