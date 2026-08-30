function currentRevisions(sourceId, source) {
  if (source?.kind === 'commit' && Array.isArray(source.immutableRefShas) && source.immutableRefShas.length > 0) {
    return [...source.immutableRefShas];
  }
  if (source?.kind === 'doc' && typeof source.retrievalDate === 'string' && source.retrievalDate) {
    return [source.retrievalDate];
  }
  throw new Error(`source ${sourceId} has no current pin`);
}

export function buildValidationEntries(card, registry) {
  const sourceIds = card?.source_ids;
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) throw new Error('card has no source IDs');

  return sourceIds.map((sourceId) => {
    const source = registry.get(sourceId);
    if (!source) throw new Error(`unknown source id ${sourceId}`);
    return { source_id: sourceId, revisions: currentRevisions(sourceId, source) };
  });
}

function normalizedEntries(entries) {
  if (!Array.isArray(entries)) return null;
  const normalized = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.source_id !== 'string' || !Array.isArray(entry.revisions)) return null;
    if (normalized.has(entry.source_id) || new Set(entry.revisions).size !== entry.revisions.length) return null;
    normalized.set(entry.source_id, [...entry.revisions].sort());
  }
  return normalized;
}

export function validationEntriesMatch(actual, expected) {
  const left = normalizedEntries(actual);
  const right = normalizedEntries(expected);
  if (!left || !right || left.size !== right.size) return false;
  for (const [sourceId, revisions] of left) {
    const expectedRevisions = right.get(sourceId);
    if (!expectedRevisions || revisions.length !== expectedRevisions.length || revisions.some((revision, index) => revision !== expectedRevisions[index])) return false;
  }
  return true;
}

export function renderValidationEntries(entries) {
  const lines = ['validated_against:'];
  for (const entry of entries) {
    lines.push(`  - source_id: ${entry.source_id}`);
    lines.push('    revisions:');
    for (const revision of entry.revisions) lines.push(`      - ${revision}`);
  }
  return `${lines.join('\n')}\n`;
}
