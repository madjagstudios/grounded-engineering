import { parse } from 'yaml';

export class FrontmatterParseError extends Error {
  constructor(filePath, reason) {
    super(`${filePath}: ${reason}`);
    this.name = 'FrontmatterParseError';
    this.reason = reason;
    this.filePath = filePath;
  }
}

export function parsePracticeFrontmatter(filePath, text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') {
    throw new FrontmatterParseError(filePath, 'practice card is missing YAML frontmatter');
  }

  const end = lines.indexOf('---', 1);
  if (end === -1) {
    throw new FrontmatterParseError(filePath, 'frontmatter is not closed');
  }

  let record;
  try {
    record = parse(lines.slice(1, end).join('\n'));
  } catch (error) {
    throw new FrontmatterParseError(filePath, `invalid YAML frontmatter: ${error.message}`);
  }

  return {
    record,
    body: lines.slice(end + 1).join('\n'),
    frontmatterEndLine: end + 1,
  };
}
