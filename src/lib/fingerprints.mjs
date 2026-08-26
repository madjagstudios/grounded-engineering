import { createHash } from 'node:crypto';
import { normalizeManagedContent, renderManagedBlock } from './managed-blocks.mjs';

export function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function fingerprintTarget(path, text, proposedBlocks) {
  // Drift checks must use this helper so marker-inclusive hashing stays consistent.
  const renderedBlocks = proposedBlocks
    .map(({ cardId, content }) => normalizeManagedContent(renderManagedBlock(cardId, content)))
    .join('\n\n');
  return {
    path,
    precondition_sha256: text === null ? 'absent' : sha256Text(text),
    managed_block_sha256: sha256Text(renderedBlocks),
  };
}
