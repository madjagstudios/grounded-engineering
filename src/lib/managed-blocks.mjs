import { createHash } from 'node:crypto';

const markerPattern = /^<!-- grounded-engineering:(begin|end) card=(GE-[A-Z]+-[0-9]{3}) -->$/gm;
const cardIdPattern = /^GE-[A-Z]+-[0-9]{3}$/;

function hashText(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function normalizeManagedContent(content) {
  return content.replace(/\r\n/g, '\n').trim();
}

export function renderManagedBlock(cardId, content) {
  if (!cardIdPattern.test(cardId)) throw new Error(`Invalid managed block card ID: ${cardId}`);
  const normalized = normalizeManagedContent(content);
  return [
    `<!-- grounded-engineering:begin card=${cardId} -->`,
    normalized,
    `<!-- grounded-engineering:end card=${cardId} -->`
  ].join('\n');
}

export function parseManagedBlocks(text) {
  const matches = [...text.matchAll(markerPattern)];
  const blocks = [];
  const seen = new Set();
  const open = [];

  for (const match of matches) {
    const [, kind, cardId] = match;
    if (kind === 'begin') {
      if (open.length > 0) throw new Error(`nested managed block inside ${open[0].cardId}`);
      if (seen.has(cardId)) throw new Error(`duplicate managed block: ${cardId}`);
      seen.add(cardId);
      open.push({ cardId, start: match.index, markerLength: match[0].length });
      continue;
    }

    if (open.length === 0) throw new Error(`unexpected managed block end marker: ${cardId}`);
    const begin = open.pop();
    if (begin.cardId !== cardId) throw new Error(`managed block end ${cardId} does not match ${begin.cardId}`);
    const rawContent = text.slice(begin.start + begin.markerLength, match.index);
    blocks.push({
      cardId,
      start: begin.start,
      end: match.index + match[0].length,
      rawContent,
      normalizedContent: normalizeManagedContent(rawContent),
    });
  }

  if (open.length > 0) throw new Error(`missing end marker for managed block: ${open[0].cardId}`);
  return blocks.sort((left, right) => left.start - right.start);
}

export function mergeManagedBlocks(existingText, proposedBlocks, options = {}) {
  const currentPreconditionSha256 = options.currentPreconditionSha256 ?? hashText(existingText);
  if (options.expectedPreconditionSha256 && options.expectedPreconditionSha256 !== currentPreconditionSha256) {
    return {
      text: existingText,
      conflicts: [{ code: 'STALE_TARGET', message: 'target full-file precondition does not match' }]
    };
  }

  let existingBlocks;
  try {
    existingBlocks = parseManagedBlocks(existingText);
  } catch (error) {
    return {
      text: existingText,
      conflicts: [{ code: 'STRUCTURAL_CONFLICT', message: error.message }]
    };
  }

  const proposedIds = new Set();
  const conflicts = [];
  for (const proposed of proposedBlocks) {
    if (!cardIdPattern.test(proposed.cardId)) {
      conflicts.push({ code: 'INVALID_CARD_ID', message: `invalid proposed card ID: ${proposed.cardId}` });
    }
    if (proposedIds.has(proposed.cardId)) {
      conflicts.push({ code: 'DUPLICATE_PROPOSAL', message: `duplicate proposed card: ${proposed.cardId}` });
    }
    proposedIds.add(proposed.cardId);

    const existing = existingBlocks.find((block) => block.cardId === proposed.cardId);
    const expected = options.expectedBlockFingerprints?.[proposed.cardId];
    if (existing && expected && expected !== (options.hash ?? hashText)(existing.normalizedContent)) {
      conflicts.push({ code: 'MANAGED_BLOCK_CHANGED', message: `managed block changed: ${proposed.cardId}` });
    }
  }
  if (conflicts.length > 0) return { text: existingText, conflicts };

  let merged = existingText;
  const replacements = existingBlocks
    .filter((block) => proposedIds.has(block.cardId))
    .map((block) => {
      const proposed = proposedBlocks.find((candidate) => candidate.cardId === block.cardId);
      return { ...block, replacement: renderManagedBlock(proposed.cardId, proposed.content) };
    })
    .sort((left, right) => right.start - left.start);

  for (const replacement of replacements) {
    merged = `${merged.slice(0, replacement.start)}${replacement.replacement}${merged.slice(replacement.end)}`;
  }

  const additions = proposedBlocks.filter((proposed) => !existingBlocks.some((block) => block.cardId === proposed.cardId));
  if (additions.length > 0) {
    const prefix = merged.length === 0 ? '' : (merged.endsWith('\n') ? '' : '\n');
    const separator = merged.length === 0 ? '' : '\n';
    merged = `${merged}${prefix}${separator}${additions.map((block) => renderManagedBlock(block.cardId, block.content)).join('\n\n')}\n`;
  }

  return { text: merged, conflicts: [] };
}
