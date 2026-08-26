import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parsePracticeFrontmatter } from './frontmatter.mjs';
import { walkRepository } from './repository-walk.mjs';

export function loadPracticeCards(root) {
  const practiceRoot = join(root, 'practices');
  const cards = [];
  const byId = new Map();
  const bySlug = new Map();

  for (const filePath of walkRepository(practiceRoot)) {
    if (!filePath.endsWith('.md') || filePath.endsWith('/README.md')) continue;

    const text = readFileSync(filePath, 'utf8');
    const { record, body } = parsePracticeFrontmatter(filePath, text);
    const slug = basename(filePath, '.md');
    if (!record?.id) throw new Error(`${filePath}: practice card is missing id`);
    if (byId.has(record.id)) throw new Error(`Duplicate practice card ID: ${record.id}`);
    if (bySlug.has(slug)) throw new Error(`Duplicate practice card slug: ${slug}`);

    const card = { ...record, body, filePath, slug };
    cards.push(card);
    byId.set(card.id, card);
    bySlug.set(card.slug, card);
  }

  cards.sort((left, right) => left.id.localeCompare(right.id));
  return { cards, byId, bySlug };
}

export function resolveCardReference(reference, index) {
  const card = index.byId.get(reference) ?? index.bySlug.get(reference);
  if (!card) throw new Error(`Unknown practice card reference: ${reference}`);
  return card;
}
