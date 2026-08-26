import { chooseCodexTarget, chooseProviderNeutralTarget } from './preflight.mjs';
import { renderBaselineDocument, renderCodexDocument } from './rendering.mjs';

const ADAPTERS = [
  {
    id: 'neutral',
    kind: 'provider-neutral-markdown',
    chooseTarget: chooseProviderNeutralTarget,
    renderDocument: renderBaselineDocument,
  },
  {
    id: 'codex',
    kind: 'codex-agents-md',
    chooseTarget: chooseCodexTarget,
    renderDocument: renderCodexDocument,
  },
];

const byId = new Map(ADAPTERS.map((adapter) => [adapter.id, adapter]));
const byKind = new Map(ADAPTERS.map((adapter) => [adapter.kind, adapter]));

export function adapterIds() {
  return ADAPTERS.map((adapter) => adapter.id);
}

export function resolveAdapter(id) {
  const adapter = byId.get(id);
  if (!adapter) throw new Error(`Unknown adapter: ${id}. Valid adapters: ${adapterIds().join(', ')}`);
  return adapter;
}

export function resolveAdapterByKind(kind) {
  const adapter = byKind.get(kind);
  if (!adapter) throw new Error(`Unsupported target kind: ${kind}`);
  return adapter;
}
