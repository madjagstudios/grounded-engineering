const SHA40 = /^[0-9a-f]{40}$/;

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
