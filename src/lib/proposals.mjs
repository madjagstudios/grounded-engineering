import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { stringify, parse } from 'yaml';
import { loadPack } from './packs.mjs';
import { loadPracticeCards, resolveCardReference } from './cards.mjs';
import { inspectRepository, chooseProviderNeutralTarget } from './preflight.mjs';
import { renderBaselineDocument, renderCardContent, renderReviewMetadata } from './rendering.mjs';
import { mergeManagedBlocks } from './managed-blocks.mjs';
import { fingerprintTarget, sha256Text } from './fingerprints.mjs';

const proposalIdPattern = /^20[0-9]{6}-[0-9]{6}-[0-9a-f]{8}$/;

function formatUtcPart(value) {
  return String(value).padStart(2, '0');
}

export function createProposalId(now, bytes = randomBytes(4)) {
  const timestamp = [
    now.getUTCFullYear(),
    formatUtcPart(now.getUTCMonth() + 1),
    formatUtcPart(now.getUTCDate())
  ].join('') + '-' + [
    formatUtcPart(now.getUTCHours()),
    formatUtcPart(now.getUTCMinutes()),
    formatUtcPart(now.getUTCSeconds())
  ].join('');
  return `${timestamp}-${Buffer.from(bytes).toString('hex').slice(0, 8)}`;
}

function proposalCards(sourceRoot, packId, cardReferences) {
  const pack = loadPack(sourceRoot, packId);
  if (!cardReferences) return { pack, cards: pack.cards };

  const index = loadPracticeCards(sourceRoot);
  const cards = cardReferences.map((reference) => resolveCardReference(reference, index));
  return { pack, cards };
}

function serializablePreflight(report) {
  const { root, ...safeReport } = report;
  return safeReport;
}

function targetBlocks(cards) {
  return cards.map((card) => ({ cardId: card.id, content: renderCardContent(card) }));
}

export function buildProposal(targetRoot, options = {}) {
  const sourceRoot = options.sourceRoot ?? resolve(new URL('../../', import.meta.url).pathname);
  const packId = options.packId ?? 'baseline';
  const { pack, cards } = proposalCards(sourceRoot, packId, options.cardReferences);
  const preflight = inspectRepository(targetRoot);
  const target = chooseProviderNeutralTarget(preflight);
  const targetPath = join(targetRoot, target.path);
  const existingText = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null;
  const blocks = targetBlocks(cards);
  const proposedContent = existingText === null
    ? renderBaselineDocument(pack, cards)
    : mergeManagedBlocks(existingText, blocks).text;
  const fingerprint = fingerprintTarget(target.path, existingText, blocks);
  const now = options.now ?? new Date();
  const proposalId = options.proposalId ?? createProposalId(now, options.randomBytes ?? randomBytes(4));

  return {
    proposal_id: proposalId,
    created_at: now.toISOString(),
    pack_id: pack.pack_id,
    pack_version: pack.pack_version,
    schema_version: pack.schema_version,
    grounded_engineering_release: pack.grounded_engineering_release,
    profile: options.profile ?? pack.pack_id,
    cards: cards.map((card) => ({
      id: card.id,
      slug: card.slug,
      title: card.title,
      public_disposition: card.disposition,
      applicability: [...card.applicability],
      evidence_level: card.evidence_level,
      source_refs: [...card.source_ids],
    })),
    preflight: serializablePreflight(preflight),
    targets: [{
      path: target.path,
      kind: 'provider-neutral-markdown',
      precondition_sha256: fingerprint.precondition_sha256,
      managed_block_sha256: fingerprint.managed_block_sha256,
      content: proposedContent,
      blocks,
    }],
    review_metadata: renderReviewMetadata(pack, cards, preflight),
  };
}

export function renderProposalDiff(targets) {
  return targets.map((target) => {
    const lines = target.content.replace(/\r\n/g, '\n').split('\n');
    const body = lines.map((line) => `+${line}`).join('\n');
    return [`--- a/${target.path}`, `+++ b/${target.path}`, `@@ -0,0 +${lines.length} @@`, body].join('\n');
  }).join('\n');
}

function proposalDirectory(root, proposalId) {
  if (!proposalIdPattern.test(proposalId)) throw new Error(`Invalid proposal ID: ${proposalId}`);
  const base = resolve(root, '.grounded-engineering', 'proposals');
  const directory = resolve(base, proposalId);
  if (!directory.startsWith(`${base}/`)) throw new Error(`Proposal path is outside the repository: ${proposalId}`);
  return directory;
}

export function saveProposal(root, proposal) {
  const directory = proposalDirectory(root, proposal.proposal_id);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'proposal.yaml'), stringify(proposal));
  writeFileSync(join(directory, 'plan.md'), `${proposal.review_metadata}\n\nNo canonical repository files were changed.\n`);
  writeFileSync(join(directory, 'diff.patch'), `${renderProposalDiff(proposal.targets)}\n`);
  writeFileSync(join(directory, 'validation.json'), `${JSON.stringify({ status: 'valid', errors: [] }, null, 2)}\n`);
  return proposal;
}

export function createProposal(root, options = {}) {
  return saveProposal(root, buildProposal(root, options));
}

export function loadProposal(root, proposalId) {
  const directory = proposalDirectory(root, proposalId);
  const proposalPath = join(directory, 'proposal.yaml');
  if (!existsSync(proposalPath)) throw new Error(`Proposal not found: ${proposalId}`);
  return parse(readFileSync(proposalPath, 'utf8'));
}

export function proposalPath(root, proposalId) {
  return proposalDirectory(root, proposalId);
}
