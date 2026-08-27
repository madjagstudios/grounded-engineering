import { renderManagedBlock } from './managed-blocks.mjs';

export function renderCardContent(card) {
  return `## ${card.title}\n\n${card.pattern}\n\n${card.agent_snippet}\n\nBoundary: ${card.rationale}`;
}

function renderCard(card) {
  return renderManagedBlock(card.id, renderCardContent(card));
}

function renderSourceRefs(card) {
  return card.source_ids.join(', ');
}

export function renderBaselineDocument(pack, cards) {
  return [
    `# Grounded Engineering baseline`,
    '',
    'Provider-neutral guidance selected from the Grounded Engineering baseline pack.',
    '',
    cards.map(renderCard).join('\n\n'),
    '',
  ].join('\n');
}

export function renderCodexDocument(pack, cards) {
  return [
    '# Agent guidance (Grounded Engineering)',
    '',
    'The following practices are managed by Grounded Engineering. Edit them with the `grounded-engineering` CLI, not by hand.',
    '',
    cards.map(renderCard).join('\n\n'),
    '',
  ].join('\n');
}

export function renderClaudeDocument(pack, cards) {
  return [
    '# Claude Code guidance (Grounded Engineering)',
    '',
    'The following practices are managed by Grounded Engineering. Edit them with the `grounded-engineering` CLI, not by hand.',
    '',
    cards.map(renderCard).join('\n\n'),
    '',
  ].join('\n');
}

export function renderReviewMetadata(pack, cards, preflight) {
  const cardRows = cards.map((card) => `| ${card.id} | ${card.title} | ${card.disposition} | ${card.evidence_level} | ${card.applicability.join(', ')} | ${renderSourceRefs(card)} |`);
  return [
    '# Grounded Engineering adoption review',
    '',
    `Pack: ${pack.pack_id} ${pack.pack_version}`,
    `Release: ${pack.grounded_engineering_release}`,
    '',
    '## Selected cards',
    '',
    '| Card ID | Practice | Public disposition | Evidence | Applicability | Source IDs |',
    '| --- | --- | --- | --- | --- | --- |',
    ...cardRows,
    '',
    '## Repository preflight',
    '',
    `Instruction files: ${preflight.instructionFiles.join(', ') || 'none detected'}`,
    `Policy files: ${preflight.policyFiles.join(', ') || 'none detected'}`,
    `CI files: ${preflight.ciFiles.join(', ') || 'none detected'}`,
    `Declared commands: ${Object.entries(preflight.declaredCommands).map(([name, command]) => `${name}=${command}`).join(', ') || 'none detected'}`,
    '',
  ].join('\n');
}
