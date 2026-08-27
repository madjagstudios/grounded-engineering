import { createHash } from 'node:crypto';
import { normalizeManagedContent, renderManagedBlock } from './managed-blocks.mjs';

export function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function fingerprintManagedBlocks(blocks) {
  return sha256Text(blocks
    .map(({ cardId, content }) => normalizeManagedContent(renderManagedBlock(cardId, content)))
    .join('\n\n'));
}

export function fingerprintTarget(path, text, proposedBlocks) {
  // Drift checks must use this helper so marker-inclusive hashing stays consistent.
  return {
    path,
    precondition_sha256: text === null ? 'absent' : sha256Text(text),
    managed_block_sha256: fingerprintManagedBlocks(proposedBlocks),
  };
}
