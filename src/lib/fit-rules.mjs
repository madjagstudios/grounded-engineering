import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { BOOLEAN_SIGNALS, SIGNALS } from './signals.mjs';

const KNOWN = new Set(SIGNALS.map((s) => s.name));
const KEYS = ['all', 'any', 'none'];

export function loadFitRules(root, cardIds) {
  const path = join(root, 'plugin', 'fit-rules.yaml');
  if (!existsSync(path)) return { rules: [], errors: [] };
  const shown = 'plugin/fit-rules.yaml';
  let raw;
  try { raw = parse(readFileSync(path, 'utf8')); }
  catch (error) { return { rules: [], errors: [`${shown}: invalid YAML: ${error.message}`] }; }
  if (!Array.isArray(raw)) return { rules: [], errors: [`${shown}: must be a list of rules`] };

  const errors = [];
  const rules = [];
  raw.forEach((rule, i) => {
    const at = `${shown} rules[${i}]`;
    const before = errors.length;
    if (!cardIds.has(rule?.card)) errors.push(`${at}: unknown card ${rule?.card}`);
    const when = Object.fromEntries(KEYS.map((k) => [k, Array.isArray(rule?.when?.[k]) ? rule.when[k] : []]));
    const extra = Object.keys(rule?.when ?? {}).filter((k) => !KEYS.includes(k));
    if (extra.length) errors.push(`${at}: unknown condition keys ${extra.join(', ')}`);
    if (KEYS.every((k) => when[k].length === 0)) errors.push(`${at}: when needs at least one condition`);
    for (const name of KEYS.flatMap((k) => when[k])) {
      if (!KNOWN.has(name)) errors.push(`${at}: unknown signal ${name}`);
      else if (!BOOLEAN_SIGNALS.has(name)) errors.push(`${at}: ${name} is not a boolean signal`);
    }
    const why = typeof rule?.why === 'string' ? rule.why.trim() : '';
    if (why.length < 10 || why.length > 100) errors.push(`${at}: why must be 10-100 characters`);
    if (errors.length === before) rules.push({ card: rule.card, when, why });
  });
  return { rules, errors };
}
