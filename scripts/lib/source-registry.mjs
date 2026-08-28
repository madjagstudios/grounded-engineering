const SHA40 = /^[0-9a-f]{40}$/;

export function isValidIsoDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

// Ordered, de-duplicated link destinations on a line. malformed=true iff a
// Markdown link is opened but not properly closed (unclosed dest, unterminated
// title, or missing link-closing ")"). Markdown dests and bare URLs both balance
// parentheses; an optional title (quoted or parenthesized) is parsed and skipped.
export function extractDestinations(line) {
  const dests = [];
  const seen = new Set();
  const add = (d) => { if (d && !seen.has(d)) { seen.add(d); dests.push(d); } };
  let malformed = false;
  let i = 0;
  while (i < line.length) {
    if (line[i] === ']' && line[i + 1] === '(') {
      i += 2;
      while (line[i] === ' ' || line[i] === '\t') i += 1;
      let dest;
      if (line[i] === '<') {
        const end = line.indexOf('>', i + 1);
        if (end === -1) { malformed = true; break; }
        dest = line.slice(i + 1, end);
        i = end + 1;
      } else {
        let depth = 1;
        const start = i;
        while (i < line.length) {
          const c = line[i];
          if (c === '(') depth += 1;
          else if (c === ')') { depth -= 1; if (depth === 0) break; }
          else if (c === ' ' || c === '\t') break; // optional title begins
          i += 1;
        }
        dest = line.slice(start, i);
      }
      // Optional title: whitespace, then "..."/'...' (with \ escapes) or (...),
      // then the link-closing ")".
      while (line[i] === ' ' || line[i] === '\t') i += 1;
      if (line[i] === '"' || line[i] === "'") {
        const q = line[i]; i += 1;
        while (i < line.length && line[i] !== q) { if (line[i] === '\\') i += 1; i += 1; }
        if (i >= line.length) { malformed = true; break; }
        i += 1; // past closing quote
      } else if (line[i] === '(') {
        let d = 1; i += 1;
        while (i < line.length && d > 0) { if (line[i] === '(') d += 1; else if (line[i] === ')') d -= 1; i += 1; }
        if (d > 0) { malformed = true; break; }
      }
      while (line[i] === ' ' || line[i] === '\t') i += 1;
      if (line[i] !== ')') { malformed = true; break; }
      i += 1; // past link-closing ")"
      add(dest);
      continue;
    }
    if (line[i] === '<') {
      const end = line.indexOf('>', i + 1);
      if (end !== -1 && /^https?:\/\//.test(line.slice(i + 1, end))) { add(line.slice(i + 1, end)); i = end + 1; continue; }
    }
    if (line.startsWith('http://', i) || line.startsWith('https://', i)) {
      let j = i;
      let depth = 0;
      while (j < line.length && !/[\s<>]/.test(line[j])) {
        const c = line[j];
        if (c === '(') depth += 1;
        else if (c === ')') { if (depth === 0) break; depth -= 1; }
        j += 1;
      }
      add(line.slice(i, j).replace(/[.,;:!?]+$/, ''));
      i = j;
      continue;
    }
    i += 1;
  }
  return { dests, malformed };
}

export function isCommitLikeUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.host === 'raw.githubusercontent.com') return true;
  if (url.host !== 'github.com') return false;
  return url.pathname.split('/')[3] === 'blob';
}

function decodeSegment(segment) {
  try { return decodeURIComponent(segment); } catch { return null; }
}

export function parseSourceUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return { kind: 'invalid', url: rawUrl, reason: 'unparseable URL' }; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { kind: 'invalid', url: rawUrl, reason: 'non-http(s) URL' };
  if (url.host === 'raw.githubusercontent.com') return { kind: 'raw', url: rawUrl };
  if (url.host !== 'github.com') return { kind: 'doc', url: rawUrl };

  const seg = url.pathname.split('/'); // ['', owner, repo, 'blob', ref, ...path]
  if (seg[3] !== 'blob') return { kind: 'doc', url: rawUrl };
  const owner = seg[1], repo = seg[2], ref = seg[4], pathSegs = seg.slice(5);
  if (!owner || !repo || !ref || pathSegs.length === 0 || pathSegs.some((s) => s === '')) {
    return { kind: 'invalid', url: rawUrl, reason: 'malformed blob URL: empty owner/repo/ref/path segment' };
  }
  if (!SHA40.test(ref)) return { kind: 'invalid', url: rawUrl, reason: 'blob ref is not a 40-hex commit' };
  if (url.search !== '' && url.search !== '?plain=1') return { kind: 'invalid', url: rawUrl, reason: `unsupported query ${url.search}` };
  const decoded = pathSegs.map(decodeSegment);
  if (decoded.some((s) => s === null)) return { kind: 'invalid', url: rawUrl, reason: 'malformed percent-escape in path' };
  return { kind: 'blob', owner, repo, commit: ref, path: decoded.join('/'), lineRange: url.hash ? url.hash.slice(1) : null, url: rawUrl };
}

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_ID_PATTERN = /^(?:CODEX|CLAUDE)-[A-Z0-9-]+$/;
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // code-point order

export function compareDiagnostics(a, b) {
  return cmpStr(a.filePath, b.filePath) || ((a.line ?? Infinity) - (b.line ?? Infinity)) || cmpStr(a.message, b.message);
}

function splitSections(text) {
  const lines = text.split(/\r?\n/); // CRLF-safe
  const sections = [];
  const preamble = [];
  let current = null;
  lines.forEach((raw, i) => {
    const heading = raw.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      if (current) sections.push(current);
      current = { id: heading[1], headingLine: i + 1, lines: [] };
    } else if (current) current.lines.push({ text: raw, number: i + 1 });
    else preamble.push({ text: raw, number: i + 1 });
  });
  if (current) sections.push(current);
  return { sections, preamble };
}

const fieldLines = (section, label) => section.lines.filter((l) => new RegExp(`^-\\s+${label}:`).test(l.text));

// Case-sensitive anchored grammar for the Immutable-reference payload.
function parseImmutableRefShas(lineText) {
  const m = lineText.match(/^-\s+Immutable reference:[ \t]*(\S.*?)[ \t]*$/);
  if (!m) return { ok: false, reason: 'unreadable Immutable reference field' };
  const cm = m[1].match(/^(commit|commits) (.+)$/); // exactly one space, lowercase keyword
  if (!cm) return { ok: false, reason: 'Immutable reference must be "commit <sha>" or "commits <sha>, ..."' };
  const items = cm[1] === 'commits' ? cm[2].split(', ') : [cm[2]];
  if (cm[1] === 'commit' && cm[2].includes(',')) return { ok: false, reason: 'singular "commit" with multiple SHAs' };
  if (cm[1] === 'commits' && items.length < 2) return { ok: false, reason: 'plural "commits" needs at least two SHAs' };
  const shas = [];
  for (const item of items) {
    const sm = item.match(/^([0-9a-f]{40})$/) || item.match(/^`([0-9a-f]{40})`$/); // bare OR matched backticks
    if (!sm) return { ok: false, reason: `Immutable reference has a non-bare-SHA token: ${item}` };
    shas.push(sm[1]);
  }
  if (new Set(shas).size !== shas.length) return { ok: false, reason: 'duplicate SHA in Immutable reference' };
  return { ok: true, shas };
}

export function buildSourceRegistry(sourcesDir) {
  const registry = new Map();
  const seenSourceIds = new Set();
  const errors = [];
  const push = (filePath, line, sourceId, message) => errors.push({ filePath, line, sourceId, message });
  const done = () => { errors.sort(compareDiagnostics); return { registry, errors }; };

  let names;
  try {
    if (!statSync(sourcesDir).isDirectory()) { push(sourcesDir, null, null, 'sources path is not a directory'); return done(); }
    names = readdirSync(sourcesDir).filter((n) => n.endsWith('.md')).sort(cmpStr);
  } catch { push(sourcesDir, null, null, 'sources directory is missing'); return done(); }
  if (names.length === 0) { push(sourcesDir, null, null, 'no Markdown files found'); return done(); }

  let sectionCount = 0;
  for (const name of names) {
    const filePath = join(sourcesDir, name);
    let text;
    try { text = readFileSync(filePath, 'utf8'); }
    catch { push(filePath, null, null, 'unreadable file'); continue; }

    const { sections, preamble } = splitSections(text);
    for (const p of preamble) {
      const { dests, malformed } = extractDestinations(p.text);
      if (malformed) push(filePath, p.number, null, 'malformed Markdown link outside any ## section');
      else if (/^-\s+(Source|Immutable reference):/.test(p.text) || dests.some(isCommitLikeUrl)) {
        push(filePath, p.number, null, 'source metadata appears outside any ## section');
      }
    }

    for (const section of sections) {
      sectionCount += 1;
      const id = section.id;
      if (!SOURCE_ID_PATTERN.test(id)) { push(filePath, section.headingLine, id, `heading "${id}" does not match source-id pattern`); continue; }
      if (seenSourceIds.has(id)) { push(filePath, section.headingLine, id, `duplicate source heading ${id}`); continue; }
      seenSourceIds.add(id);

      const sourceLines = fieldLines(section, 'Source');
      const immLines = fieldLines(section, 'Immutable reference');
      if (sourceLines.length !== 1) { push(filePath, section.headingLine, id, `expected exactly one Source field, found ${sourceLines.length}`); continue; }
      if (immLines.length !== 1) { push(filePath, section.headingLine, id, `expected exactly one Immutable reference field, found ${immLines.length}`); continue; }

      const extracted = extractDestinations(sourceLines[0].text);
      if (extracted.malformed) { push(filePath, sourceLines[0].number, id, 'malformed Markdown link in Source field'); continue; }
      const parsed = extracted.dests.map(parseSourceUrl);
      if (parsed.length === 0) { push(filePath, sourceLines[0].number, id, 'Source field has no URL'); continue; }
      const invalid = parsed.find((u) => u.kind === 'invalid');
      if (invalid) { push(filePath, sourceLines[0].number, id, `invalid Source URL: ${invalid.reason}`); continue; }
      if (parsed.some((u) => u.kind === 'raw')) { push(filePath, sourceLines[0].number, id, 'Source URL on unsupported raw host'); continue; }

      const blobs = parsed.filter((u) => u.kind === 'blob');
      const docs = parsed.filter((u) => u.kind === 'doc');
      if (blobs.length > 0 && docs.length > 0) { push(filePath, sourceLines[0].number, id, 'mixed commit and doc URLs in one Source field'); continue; }

      if (blobs.length > 0) {
        const ref = parseImmutableRefShas(immLines[0].text);
        if (!ref.ok) { push(filePath, immLines[0].number, id, ref.reason); continue; }
        const urlShas = new Set(blobs.map((b) => b.commit));
        const refShas = new Set(ref.shas);
        if (urlShas.size !== refShas.size || [...urlShas].some((s) => !refShas.has(s))) { push(filePath, immLines[0].number, id, 'Immutable-reference SHA set does not match Source URL SHA set'); continue; }
        registry.set(id, { id, kind: 'commit', filePath, headingLine: section.headingLine, sourceField: sourceLines[0].text, immutableRefShas: ref.shas, retrievalDate: null,
          targets: blobs.map((b) => ({ owner: b.owner, repo: b.repo, commit: b.commit, path: b.path, lineRange: b.lineRange, url: b.url, sourceId: id, filePath, headingLine: section.headingLine })) });
      } else {
        let stray = null;
        for (const l of section.lines) {
          const r = extractDestinations(l.text);
          if (r.malformed) { stray = { number: l.number, message: 'malformed Markdown link in a doc section' }; break; }
          if (r.dests.some(isCommitLikeUrl)) { stray = { number: l.number, message: 'commit-like URL present outside Source in a doc section' }; break; }
        }
        if (stray) { push(filePath, stray.number, id, stray.message); continue; }
        const imm = immLines[0].text;
        const date = imm.match(/retrieved\s+(\d{4}-\d{2}-\d{2})/i);
        const marker = /unversioned/i.test(imm) && /re-audit/i.test(imm);
        if (!date || !marker) { push(filePath, immLines[0].number, id, 'doc section requires a retrieval date and an unversioned/re-audit marker'); continue; }
        if (!isValidIsoDate(date[1])) { push(filePath, immLines[0].number, id, `retrieval date ${date[1]} is not a valid calendar date`); continue; }
        registry.set(id, { id, kind: 'doc', filePath, headingLine: section.headingLine, sourceField: sourceLines[0].text, immutableRefShas: [], retrievalDate: date[1], targets: [] });
      }
    }
  }
  if (sectionCount === 0) push(sourcesDir, null, null, 'no ## sections found');
  return done();
}

export function validateCardSourceReferences(cards, registry) {
  const diagnostics = [];
  for (const { record, filePath } of cards) {
    const sourceIds = record.source_ids ?? [];
    const evidenceIds = (record.evidence_refs ?? []).map((r) => r.source_id);
    for (const id of new Set([...sourceIds, ...evidenceIds])) {
      if (!registry.has(id)) diagnostics.push({ filePath, line: null, sourceId: id, message: `unknown source id ${id}` });
    }
    const a = new Set(sourceIds);
    const b = new Set(evidenceIds);
    if (a.size !== b.size || [...a].some((id) => !b.has(id))) {
      diagnostics.push({ filePath, line: null, sourceId: null, message: 'source_ids and evidence_refs source-id sets differ' });
    }
  }
  diagnostics.sort(compareDiagnostics);
  return diagnostics;
}

export function validateCardValidationProvenance(cards, registry) {
  const diagnostics = [];
  const push = (filePath, sourceId, message) => diagnostics.push({ filePath, line: null, sourceId, message });
  for (const { record, filePath } of cards) {
    const status = record.validation?.status;
    const entries = record.validation?.validated_against ?? [];
    if (status === 'not_validated') {
      if (entries.length > 0) push(filePath, null, 'not_validated card must not carry validated_against');
      continue;
    }
    if (status !== 'validated' && status !== 'needs_review') continue; // schema owns other states

    const entrySourceIds = entries.map((e) => e.source_id);
    const cardSources = new Set(record.source_ids ?? []);
    const entrySet = new Set(entrySourceIds);
    for (const id of new Set(entrySourceIds.filter((id, i) => entrySourceIds.indexOf(id) !== i))) {
      push(filePath, id, `duplicate validated_against entry for ${id}`);
    }
    for (const id of entrySet) if (!cardSources.has(id)) push(filePath, id, `validated_against references ${id}, not in source_ids`);
    for (const id of cardSources) if (!entrySet.has(id)) push(filePath, id, `validated_against missing entry for ${id}`);

    for (const entry of entries) {
      const rec = registry.get(entry.source_id);
      if (!rec) { push(filePath, entry.source_id, `validated_against references unknown source ${entry.source_id}`); continue; }
      const revisions = entry.revisions ?? [];
      for (const r of revisions) {
        if (!/^[0-9a-f]{40}$/.test(r) && !isValidIsoDate(r)) {
          push(filePath, entry.source_id, `revision ${r} for ${entry.source_id} is not a SHA or valid calendar date`);
        }
      }
      if (status === 'validated') {
        const pins = rec.kind === 'commit' ? rec.immutableRefShas : (rec.retrievalDate ? [rec.retrievalDate] : []);
        const got = [...new Set(revisions)].sort();
        const want = [...new Set(pins)].sort();
        if (got.length !== want.length || got.some((v, i) => v !== want[i])) {
          push(filePath, entry.source_id, `validated: ${entry.source_id} recorded revisions [${got.join(', ')}] do not equal current pin [${want.join(', ')}]`);
        }
      }
      // needs_review: well-formedness only (checked above); no pin/kind match required.
    }
  }
  diagnostics.sort(compareDiagnostics);
  return diagnostics;
}
