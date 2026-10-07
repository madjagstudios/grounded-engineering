// Reads `claude plugin validate plugin` output on stdin, echoes it, and fails when the engine
// reports a call outside the plugin's allowed capabilities. The engine's own scan follows `$`
// through every helper, so this catches what a text search of the sources could miss.
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const ALLOWED_CALLS = new Set([
  '$.command.register', '$.command.run', '$.fs.read', '$.fs.exists', '$.fs.list',
  '$.state.get', '$.state.set', '$.ui.open', '$.ui.resolve', '$.ui.toast',
]);

const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');

// A line that starts a new part of the validator's output: an item (`\u276f`), a result mark,
// a "Validating ..." heading, or a notice npm prints around npx. Any other non-blank line
// after a `calls:` line is that line wrapped, and is read as more of it.
const SECTION_LINE = /^\s*(?:[\u276f\u2714\u2716\u2718\u26a0]\s|Validating\b|npm (?:notice|warn|WARN)\b)/;
const CALL_SHAPE = /^\$\.[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/;

// Every piece named on a `calls:` line and its continuation lines, with the engine's
// "(via helper, ...)" notes removed before the list is split on commas.
export function parseCalls(text) {
  const lines = stripAnsi(text).split(/\r?\n/);
  const calls = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /\bcalls:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    let list = m[1];
    while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !SECTION_LINE.test(lines[i + 1])) {
      i += 1;
      list += ` ${lines[i].trim()}`;
    }
    for (const part of list.replace(/\(via [^)]*\)/g, '').split(',')) {
      const call = part.trim();
      if (call) calls.push(call);
    }
  }
  return calls;
}

export function checkPluginCalls(text) {
  const calls = parseCalls(text);
  if (!/\bcalls:/.test(stripAnsi(text))) return { ok: false, calls, errors: ['no calls line found in the plugin validator output'] };
  const errors = calls.map((c) => {
    if (!CALL_SHAPE.test(c)) return `${c} is not shaped like a call`;
    return ALLOWED_CALLS.has(c) ? null : `${c} is not an allowed plugin call`;
  }).filter(Boolean);
  return { ok: errors.length === 0, calls, errors };
}

const isMain = process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
if (isMain) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    process.stdout.write(input);
    const result = checkPluginCalls(input);
    for (const error of result.errors) process.stderr.write(`check-plugin-calls: ${error}\n`);
    process.exitCode = result.ok ? 0 : 1;
  });
}
