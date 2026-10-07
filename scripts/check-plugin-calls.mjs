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

// Every call named on a `calls:` line, without the engine's "(via helper)" notes.
export function parseCalls(text) {
  const calls = [];
  for (const line of stripAnsi(text).split(/\r?\n/)) {
    const m = /\bcalls:\s*(.*)$/.exec(line);
    if (!m) continue;
    for (const part of m[1].split(',')) {
      const call = part.replace(/\(via [^)]*\)/g, '').trim();
      if (call) calls.push(call);
    }
  }
  return calls;
}

export function checkPluginCalls(text) {
  const calls = parseCalls(text);
  if (!/\bcalls:/.test(stripAnsi(text))) return { ok: false, calls, errors: ['no calls line found in the plugin validator output'] };
  const errors = calls.filter((c) => !ALLOWED_CALLS.has(c)).map((c) => `${c} is not an allowed plugin call`);
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
