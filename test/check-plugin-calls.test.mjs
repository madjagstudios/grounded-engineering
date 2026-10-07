import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkPluginCalls, parseCalls } from '../scripts/check-plugin-calls.mjs';

const script = fileURLToPath(new URL('../scripts/check-plugin-calls.mjs', import.meta.url));

// The shape `claude plugin validate plugin` prints for a hooks module.
const sample = (calls) => `Validating hooks: plugin/hooks/hooks.json

  ❯ ./register.tsx hooks: session.start, ui.render{component=Pane, requestId=grounded}
  ❯ ./register.tsx calls: ${calls}
  ❯ ./register.tsx state writes: grounded-engineering.query

✔ Validation passed
`;

const ALLOWED = '$.command.register, $.command.run, $.fs.exists (via hostOf), $.fs.list (via hostOf), $.fs.read (via hostOf), $.state.get, $.state.set, $.ui.open (via openOn), $.ui.resolve, $.ui.toast';

test('the calls line is read without its "via" notes', () => {
  assert.deepEqual(parseCalls(sample('$.fs.read (via hostOf), $.ui.toast')), ['$.fs.read', '$.ui.toast']);
});

test('calls on several lines and in color are all read', () => {
  const text = `\u001b[2m  ❯ ./a.tsx calls: $.fs.read\u001b[0m\n  ❯ ./b.tsx calls: $.process.run (via x)\n`;
  assert.deepEqual(parseCalls(text), ['$.fs.read', '$.process.run']);
});

test('a note naming two helpers is stripped whole, commas and all', () => {
  assert.deepEqual(parseCalls(sample('$.fs.read (via hostOf, refreshRepo), $.ui.toast')), ['$.fs.read', '$.ui.toast']);
  assert.equal(checkPluginCalls(sample(`${ALLOWED}, $.fs.list (via hostOf, refreshRepo)`)).ok, true);
});

test('a calls line wrapped onto the next line is read to its end', () => {
  const text = `  \u276f ./register.tsx calls: $.command.register, $.fs.read (via hostOf,\n      refreshRepo), $.process.run\n  \u276f ./register.tsx state writes: x\n`;
  assert.deepEqual(parseCalls(text), ['$.command.register', '$.fs.read', '$.process.run']);
  const result = checkPluginCalls(text);
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['$.process.run is not an allowed plugin call']);
});

test('a piece that is not shaped like a call fails', () => {
  for (const piece of ['fetch', '$.fs.read()', 'refreshRepo)', '$fs.read', '$.']) {
    const result = checkPluginCalls(sample(`${ALLOWED}, ${piece}`));
    assert.equal(result.ok, false, piece);
    assert.match(result.errors.join('\n'), /is not shaped like a call/, piece);
  }
});

test('the allowed calls pass', () => {
  assert.deepEqual(checkPluginCalls(sample(ALLOWED)), { ok: true, calls: parseCalls(sample(ALLOWED)), errors: [] });
});

test('a call outside the allowlist fails and is named', () => {
  for (const call of ['$.fs.write', '$.process.run', '$.http.get', '$.model.ask', '$.tool.call', '$.prompt.submit']) {
    const result = checkPluginCalls(sample(`${ALLOWED}, ${call} (via hostOf)`));
    assert.equal(result.ok, false, call);
    assert.deepEqual(result.errors, [`${call} is not an allowed plugin call`]);
  }
});

test('output with no calls line fails rather than passing unread', () => {
  const result = checkPluginCalls('Validating plugin manifest\n\n✔ Validation passed\n');
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /no calls line/);
});

test('the script echoes its input and exits by the result', () => {
  const good = spawnSync(process.execPath, [script], { input: sample(ALLOWED), encoding: 'utf8' });
  assert.equal(good.status, 0, good.stderr);
  assert.equal(good.stdout, sample(ALLOWED));
  const bad = spawnSync(process.execPath, [script], { input: sample('$.fs.write'), encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /\$\.fs\.write is not an allowed plugin call/);
});
