import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { resolveAdapterByKind } from './adapters.mjs';
import { fingerprintManagedBlocks } from './fingerprints.mjs';
import { validateManifest } from './manifest.mjs';
import { parseManagedBlocks } from './managed-blocks.mjs';
import { loadPack } from './packs.mjs';

const repositoryRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));

function safeRepositoryPath(root, path) {
  if (path.startsWith('/') || path.split('/').some((part) => part === '..' || part === '')) {
    throw new Error(`Unsafe repository path: ${path}`);
  }
  const rootPath = resolve(root);
  const absolute = resolve(rootPath, path);
  if (!absolute.startsWith(`${rootPath}/`)) throw new Error(`Repository path escapes root: ${path}`);
  return absolute;
}

function formatValidationErrors(errors) {
  return (errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`).join('; ');
}

export function checkRepository(targetRoot, options = {}) {
  const sourceRoot = options.sourceRoot ?? repositoryRoot;
  const manifestPath = '.grounded-engineering/manifest.yaml';
  const diagnostics = [];
  const manifestFile = safeRepositoryPath(targetRoot, manifestPath);

  if (!existsSync(manifestFile)) {
    return {
      ok: false,
      diagnostics: [{
        code: 'MISSING_MANIFEST',
        message: 'Grounded Engineering manifest not found at .grounded-engineering/manifest.yaml.',
      }],
    };
  }

  let manifest;
  try {
    manifest = parse(readFileSync(manifestFile, 'utf8'));
  } catch (error) {
    return {
      ok: false,
      diagnostics: [{
        code: 'INVALID_MANIFEST',
        message: `Manifest is invalid: ${error.message}`,
      }],
    };
  }

  const validation = validateManifest(manifest, sourceRoot);
  if (!validation.valid) {
    return {
      ok: false,
      diagnostics: [{
        code: 'INVALID_MANIFEST',
        message: `Manifest is invalid: ${formatValidationErrors(validation.errors)}`,
      }],
    };
  }

  let pack;
  try {
    pack = loadPack(sourceRoot, manifest.pack_id);
  } catch {
    return {
      ok: false,
      diagnostics: [{
        code: 'PACK_UNAVAILABLE',
        message: `Unable to load pack ${manifest.pack_id} from the installed CLI bundle.`,
      }],
    };
  }

  if (
    manifest.schema_version !== pack.schema_version ||
    manifest.pack_id !== pack.pack_id ||
    manifest.pack_version !== pack.pack_version ||
    manifest.grounded_engineering_release !== pack.grounded_engineering_release
  ) {
    return {
      ok: false,
      diagnostics: [{
        code: 'PACK_METADATA_MISMATCH',
        message: `Manifest pack metadata does not match the installed CLI bundle for ${manifest.pack_id}.`,
      }],
    };
  }

  const packCardsById = new Map(pack.cards.map((card) => [card.id, card]));
  for (const card of manifest.cards) {
    const packCard = packCardsById.get(card.id);
    const matchingSources = packCard
      && card.source_refs.length === packCard.source_ids.length
      && card.source_refs.every((value, index) => value === packCard.source_ids[index]);

    if (!packCard || card.public_disposition !== packCard.disposition || !matchingSources) {
      diagnostics.push({
        code: 'CARD_METADATA_MISMATCH',
        message: `Manifest card metadata no longer matches the installed CLI bundle for ${card.id}.`,
      });
    }
  }

  const expectedCardIds = manifest.cards.map((card) => card.id);
  for (const target of manifest.targets) {
    try {
      resolveAdapterByKind(target.kind);
    } catch {
      diagnostics.push({
        code: 'UNSUPPORTED_TARGET',
        message: `Unsupported managed target kind: ${target.kind}.`,
      });
      continue;
    }

    const targetFile = safeRepositoryPath(targetRoot, target.path);
    if (!existsSync(targetFile)) {
      diagnostics.push({
        code: 'MISSING_TARGET',
        message: `Managed target is missing: ${target.path}.`,
      });
      continue;
    }

    let parsedBlocks;
    try {
      parsedBlocks = parseManagedBlocks(readFileSync(targetFile, 'utf8'));
    } catch (error) {
      diagnostics.push({
        code: 'STRUCTURAL_CONFLICT',
        message: `Managed markers are malformed in ${target.path}: ${error.message}`,
      });
      continue;
    }

    const parsedCardIds = parsedBlocks.map((block) => block.cardId).sort();
    const sortedExpectedIds = [...expectedCardIds].sort();
    const matchingSet = parsedCardIds.length === sortedExpectedIds.length
      && parsedCardIds.every((value, index) => value === sortedExpectedIds[index]);

    if (!matchingSet) {
      diagnostics.push({
        code: 'MANAGED_CARD_SET_MISMATCH',
        message: `Managed block set does not match the manifest for ${target.path}.`,
      });
      continue;
    }

    const parsedBlocksById = new Map(parsedBlocks.map((block) => [block.cardId, block]));
    const fingerprint = fingerprintManagedBlocks(
      expectedCardIds.map((cardId) => ({
        cardId,
        content: parsedBlocksById.get(cardId).normalizedContent,
      }))
    );

    if (fingerprint !== target.managed_block_sha256) {
      diagnostics.push({
        code: 'MANAGED_BLOCK_CHANGED',
        message: `Managed block content no longer matches the manifest for ${target.path}.`,
      });
    }
  }

  return {
    ok: diagnostics.length === 0,
    diagnostics,
  };
}
