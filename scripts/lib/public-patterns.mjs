import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Text that should never appear in the public tree, for any maintainer.
export const GENERIC_PUBLIC_PATTERNS = Object.freeze([
  /\bTODO\b/i, /\bTBD\b/i, /\bPLACEHOLDER\b/i, /\/Users\//, /\/home\//
]);

export const LOCAL_PATTERNS_PATH = '.private/public-content-patterns.txt';

// A maintainer can add their own patterns in an untracked file, one per line:
// /source/flags, or a case-sensitive source that does not start with a slash.
// Lines starting with # are comments. The g and y flags are dropped because the
// same pattern is tested against every file.
export function loadLocalPublicPatterns(root) {
  const path = join(root, LOCAL_PATTERNS_PATH);
  if (!existsSync(path)) return { patterns: [], errors: [] };
  let text;
  try { text = readFileSync(path, 'utf8'); }
  catch (error) { return { patterns: [], errors: [`${LOCAL_PATTERNS_PATH}: cannot read: ${error.message}`] }; }

  const patterns = [];
  const errors = [];
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const delimited = /^\/(.+)\/([A-Za-z]*)$/.exec(line);
    try {
      patterns.push(delimited
        ? new RegExp(delimited[1], delimited[2].replace(/[gy]/g, ''))
        : new RegExp(line));
    } catch (error) {
      errors.push(`${LOCAL_PATTERNS_PATH}:${index + 1}: invalid pattern: ${error.message}`);
    }
  });
  return { patterns, errors };
}
