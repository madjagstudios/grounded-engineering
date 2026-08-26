import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify, parse } from 'yaml';
import { loadPack } from './packs.mjs';
import { loadPracticeCards, resolveCardReference } from './cards.mjs';
import { inspectRepository, chooseProviderNeutralTarget } from './preflight.mjs';
import { renderBaselineDocument, renderCardContent, renderReviewMetadata } from './rendering.mjs';
import { mergeManagedBlocks } from './managed-blocks.mjs';
import { fingerprintTarget, sha256Text } from './fingerprints.mjs';
import { buildManifest, validateManifest } from './manifest.mjs';

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

const applicabilityValues = new Set(['APPLICABLE', 'NOT_APPLICABLE', 'NEEDS_REVIEW']);
const decisionValues = new Set(['ACCEPT', 'ADAPT', 'DECLINE', 'DEFER']);

export function collectLocalDecisions(cards, input) {
  if (!Array.isArray(input)) throw new Error('Reviewed local decisions are required before apply');
  const byId = new Map();
  for (const record of input) {
    if (!record?.id) throw new Error('Every local decision must include a card id');
    if (byId.has(record.id)) throw new Error(`Duplicate local decision: ${record.id}`);
    byId.set(record.id, record);
  }

  return cards.map((card) => {
    const record = byId.get(card.id);
    if (!record) throw new Error(`Missing local decision for ${card.id}`);
    if (!applicabilityValues.has(record.local_applicability)) {
      throw new Error(`Invalid local_applicability for ${card.id}`);
    }
    if (record.local_applicability === 'APPLICABLE' && !record.local_decision) {
      throw new Error(`local_decision is required for ${card.id}`);
    }
    if (record.local_applicability === 'NOT_APPLICABLE' && record.local_decision) {
      throw new Error(`${card.id} must not include local_decision when not applicable`);
    }
    if (record.local_applicability === 'NEEDS_REVIEW' && record.local_decision) {
      throw new Error(`${card.id} cannot have local_decision while it needs review`);
    }
    if (record.local_applicability === 'NEEDS_REVIEW') {
      throw new Error(`${card.id} remains NEEDS_REVIEW; complete the local review before apply`);
    }
    if (record.local_decision && !decisionValues.has(record.local_decision)) {
      throw new Error(`Invalid local_decision for ${card.id}`);
    }
    if (record.local_decision === 'DEFER' && !record.revisit_trigger) {
      throw new Error(`revisit_trigger is required when ${card.id} is deferred`);
    }
    return {
      id: card.id,
      local_applicability: record.local_applicability,
      ...(record.local_decision ? { local_decision: record.local_decision } : {}),
      ...(record.revisit_trigger ? { revisit_trigger: record.revisit_trigger } : {}),
    };
  });
}

export function buildProposal(targetRoot, options = {}) {
  const sourceRoot = options.sourceRoot ?? resolve(fileURLToPath(new URL('../../', import.meta.url)));
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
    local_decisions: cards.map((card) => ({
      id: card.id,
      local_applicability: 'NEEDS_REVIEW',
    })),
    preflight: serializablePreflight(preflight),
    targets: [{
      path: target.path,
      kind: 'provider-neutral-markdown',
      precondition_sha256: fingerprint.precondition_sha256,
      managed_block_sha256: fingerprint.managed_block_sha256,
      before_content: existingText,
      content: proposedContent,
      blocks,
    }],
    review_metadata: renderReviewMetadata(pack, cards, preflight),
  };
}

export function renderProposalDiff(targets) {
  return targets.map((target) => {
    const before = target.before_content === null || target.before_content === undefined
      ? null
      : target.before_content.replace(/\r\n/g, '\n').split('\n');
    const after = target.content.replace(/\r\n/g, '\n').split('\n');
    if (before?.at(-1) === '') before.pop();
    if (after.at(-1) === '') after.pop();
    if (before === null) {
      return [`--- /dev/null`, `+++ b/${target.path}`, `@@ -0,0 +1,${after.length} @@`, ...after.map((line) => `+${line}`)].join('\n');
    }

    if (before.length === after.length && before.every((line, index) => line === after[index])) {
      return [`--- a/${target.path}`, `+++ b/${target.path}`].join('\n');
    }

    let prefix = 0;
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
    let suffix = 0;
    while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
    const context = 3;
    const oldStart = Math.max(0, prefix - context);
    const newStart = Math.max(0, prefix - context);
    const oldEnd = Math.min(before.length, before.length - suffix + context);
    const lines = [];
    for (let index = oldStart; index < prefix && index < oldEnd; index += 1) lines.push(` ${before[index]}`);
    for (let index = prefix; index < before.length - suffix; index += 1) lines.push(`-${before[index]}`);
    for (let index = prefix; index < after.length - suffix; index += 1) lines.push(`+${after[index]}`);
    for (let index = Math.max(prefix, before.length - suffix); index < oldEnd; index += 1) lines.push(` ${before[index]}`);
    const oldCount = oldEnd - oldStart;
    const trailingContext = oldEnd - Math.max(prefix, before.length - suffix);
    const newCount = (prefix - oldStart) + (after.length - prefix - suffix) + trailingContext;
    return [`--- a/${target.path}`, `+++ b/${target.path}`, `@@ -${oldStart + 1},${oldCount} +${newStart + 1},${newCount} @@`, ...lines].join('\n');
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
  writeFileSync(join(directory, 'plan.md'), `${proposal.review_metadata}\n\nReview and complete local_decisions in proposal.yaml before applying. No canonical repository files were changed.\n`);
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

function safeRepositoryPath(root, path) {
  if (path.startsWith('/') || path.split('/').some((part) => part === '..' || part === '')) {
    throw new Error(`Unsafe repository path: ${path}`);
  }
  const rootPath = resolve(root);
  const absolute = resolve(rootPath, path);
  if (!absolute.startsWith(`${rootPath}/`)) throw new Error(`Repository path escapes root: ${path}`);
  return absolute;
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateProposalAgainstPack(proposal, pack) {
  if (proposal.schema_version !== pack.schema_version || proposal.pack_version !== pack.pack_version || proposal.grounded_engineering_release !== pack.grounded_engineering_release) {
    throw new Error('Proposal pack, schema, or release metadata no longer matches the local release');
  }
  const proposalIds = proposal.cards.map((card) => card.id);
  const expectedCards = pack.cards.filter((card) => proposalIds.includes(card.id));
  if (!sameValues(proposalIds, expectedCards.map((card) => card.id))) {
    throw new Error('Proposal card selection does not match the local pack');
  }
  for (const [index, card] of expectedCards.entries()) {
    const proposed = proposal.cards[index];
    if (proposed.public_disposition !== card.disposition || proposed.slug !== card.slug) {
      throw new Error(`Proposal card metadata no longer matches ${card.id}`);
    }
  }
  return expectedCards;
}

function buildApplyChanges(root, proposal, pack, cards, decisions) {
  const manifestPath = '.grounded-engineering/manifest.yaml';
  if (existsSync(safeRepositoryPath(root, manifestPath))) {
    throw new Error('A Grounded Engineering manifest already exists; update is reserved for a later release');
  }

  const changes = [];
  for (const target of proposal.targets) {
    if (target.kind !== 'provider-neutral-markdown') throw new Error(`Unsupported target kind: ${target.kind}`);
    const targetPath = safeRepositoryPath(root, target.path);
    const currentText = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null;
    const currentFingerprint = currentText === null ? 'absent' : sha256Text(currentText);
    if (currentFingerprint !== target.precondition_sha256) {
      throw new Error(`Target precondition does not match for ${target.path}`);
    }

    const blocks = cards.map((card) => ({ cardId: card.id, content: renderCardContent(card) }));
    let proposedContent;
    if (currentText === null) {
      proposedContent = renderBaselineDocument(pack, cards);
    } else {
      const merged = mergeManagedBlocks(currentText, blocks, {
        expectedPreconditionSha256: target.precondition_sha256,
      });
      if (merged.conflicts.length > 0) {
        throw new Error(`Cannot apply ${target.path}: ${merged.conflicts.map((conflict) => conflict.message).join('; ')}`);
      }
      proposedContent = merged.text;
    }
    const expectedFingerprint = fingerprintTarget(target.path, proposedContent, blocks);
    if (expectedFingerprint.managed_block_sha256 !== target.managed_block_sha256) {
      throw new Error(`Proposal content does not match the selected cards for ${target.path}`);
    }
    changes.push({ path: target.path, content: proposedContent });
  }

  const manifest = buildManifest({
    schema_version: proposal.schema_version,
    grounded_engineering_release: proposal.grounded_engineering_release,
    pack_id: proposal.pack_id,
    pack_version: proposal.pack_version,
    cards: cards.map((card) => {
      const decision = decisions.find((item) => item.id === card.id);
      return {
        id: card.id,
        public_disposition: card.disposition,
        ...decision,
        source_refs: [...card.source_ids],
      };
    }),
    targets: proposal.targets.map((target) => ({
      path: target.path,
      kind: target.kind,
      precondition_sha256: target.precondition_sha256,
      managed_block_sha256: target.managed_block_sha256,
    })),
    validation: { status: 'validated' },
  });
  const validation = validateManifest(manifest);
  if (!validation.valid) throw new Error(`Generated manifest is invalid: ${JSON.stringify(validation.errors)}`);
  changes.push({ path: manifestPath, content: stringify(manifest) });
  return { changes, manifest };
}

export function writeApplyTransaction(root, changes) {
  const tempRoot = safeRepositoryPath(root, `.grounded-engineering/.apply-${randomBytes(8).toString('hex')}`);
  mkdirSync(tempRoot, { recursive: true });
  const staged = [];
  try {
    for (const [index, change] of changes.entries()) {
      const targetPath = safeRepositoryPath(root, change.path);
      const temporaryPath = join(tempRoot, `staged-${index}`);
      mkdirSync(dirname(temporaryPath), { recursive: true });
      writeFileSync(temporaryPath, change.content);
      staged.push({ change, targetPath, temporaryPath, backupPath: join(tempRoot, `backup-${index}`), hadOriginal: false, installed: false });
    }

    for (const entry of staged) {
      mkdirSync(dirname(entry.targetPath), { recursive: true });
      if (existsSync(entry.targetPath)) {
        renameSync(entry.targetPath, entry.backupPath);
        entry.hadOriginal = true;
      }
      renameSync(entry.temporaryPath, entry.targetPath);
      entry.installed = true;
    }
    return { committedPaths: changes.map((change) => change.path) };
  } catch (error) {
    for (const entry of [...staged].reverse()) {
      if (entry.installed && existsSync(entry.targetPath)) unlinkSync(entry.targetPath);
      if (entry.hadOriginal && existsSync(entry.backupPath)) renameSync(entry.backupPath, entry.targetPath);
    }
    throw new Error(`Apply transaction rolled back: ${error.message}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function applyProposal(root, proposalId, options = {}) {
  if (!options.confirm) throw new Error('Apply requires explicit confirmation with --confirm');
  const proposal = loadProposal(root, proposalId);
  const sourceRoot = options.sourceRoot ?? resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const pack = loadPack(sourceRoot, proposal.pack_id);
  const cards = validateProposalAgainstPack(proposal, pack);
  const decisions = collectLocalDecisions(cards, options.decisions ?? proposal.local_decisions);
  const { changes, manifest } = buildApplyChanges(root, proposal, pack, cards, decisions);
  const transaction = writeApplyTransaction(root, changes);
  return { ...transaction, manifest };
}
