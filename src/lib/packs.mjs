import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { loadPracticeCards, resolveCardReference } from './cards.mjs';

function formatErrors(errors) {
  return (errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`).join('; ');
}

export function loadPack(root, packId) {
  const packPath = join(root, 'packs', `${packId}.yaml`);
  const schema = parse(readFileSync(join(root, 'packs', 'schema.yaml'), 'utf8'));
  const rawPack = parse(readFileSync(packPath, 'utf8'));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validate(rawPack)) throw new Error(`Invalid adoption pack ${packId}: ${formatErrors(validate.errors)}`);

  const index = loadPracticeCards(root);
  const cards = rawPack.card_ids.map((cardId) => {
    const card = resolveCardReference(cardId, index);
    if (card.id !== cardId) throw new Error(`Pack ${packId} must use canonical card ID ${card.id}, received ${cardId}`);
    return card;
  });

  return { ...rawPack, cards };
}
