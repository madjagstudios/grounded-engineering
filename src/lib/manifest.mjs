import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';

const repositoryRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));

export function getManifestValidator(root = repositoryRoot) {
  const schema = parse(readFileSync(`${root}/packs/manifest-schema.yaml`, 'utf8'));
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

export function buildManifest(input) {
  return {
    record_type: 'adoption_manifest',
    manifest_version: '1.0.0',
    schema_version: input.schema_version,
    grounded_engineering_release: input.grounded_engineering_release,
    pack_id: input.pack_id,
    pack_version: input.pack_version,
    cards: input.cards.map((card) => ({
      id: card.id,
      public_disposition: card.public_disposition,
      local_applicability: card.local_applicability,
      ...(card.local_decision ? { local_decision: card.local_decision } : {}),
      ...(card.revisit_trigger ? { revisit_trigger: card.revisit_trigger } : {}),
      source_refs: [...card.source_refs],
    })),
    targets: input.targets.map((target) => ({
      path: target.path,
      kind: target.kind,
      precondition_sha256: target.precondition_sha256,
      managed_block_sha256: target.managed_block_sha256,
    })),
    validation: {
      status: input.validation.status,
      ...(input.validation.errors?.length ? { errors: [...input.validation.errors] } : {}),
    },
  };
}

export function validateManifest(manifest, root = repositoryRoot) {
  const validate = getManifestValidator(root);
  const valid = validate(manifest);
  return { valid, errors: validate.errors ?? [] };
}
