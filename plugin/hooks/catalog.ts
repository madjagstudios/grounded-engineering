import type { FsEntry } from 'claude-code'

// What the core reads through. Built from a hook's `$` by `hostOf` in register.tsx.
export type Host = {
  fs: { read(path: string): Promise<string>; exists(path: string): Promise<boolean>; list(path?: string): Promise<FsEntry[]> }
  plugin: { root: string }
}

export type Source = { id: string; url: string }
export type FitRule = { card: string; when: { all: string[]; any: string[]; none: string[] }; why: string }
export type Practice = {
  id: string; title: string; category: string; subcategory: string; pattern: string; rationale: string
  agent_snippet: string | null; applicability: string[]; control_types: string[]; confidence: string
  validation_status: string; source_ids: string[]; path: string; body: string
}
export type SkillRepo = {
  id: string; name: string; repo: string; license: string; pinned_commit: string; reviewed_on: string
  best_for: string[]; tags: string[]; summary: string; watch_out_for: string
  install: string[]; install_note: string | null; featured: boolean
}
export type Catalog = {
  catalog_version: number; package_version: string; repository: string
  signals: { name: string; type: string; description: string }[]
  categories: string[]; practices: Practice[]; skill_repos: SkillRepo[]; fit_rules: FitRule[]; sources: Source[]
}

export async function loadCatalog(host: Host): Promise<Catalog> {
  try {
    const catalog = JSON.parse(String(await host.fs.read(`${host.plugin.root}/catalog.json`))) as Catalog | null
    if (catalog === null || typeof catalog !== 'object' || catalog.catalog_version !== 1) {
      throw new Error('unexpected catalog_version or shape')
    }
    for (const field of ['practices', 'fit_rules', 'skill_repos', 'categories', 'signals', 'sources'] as const) {
      if (!Array.isArray(catalog[field])) throw new Error(`${field} is not a list`)
    }
    // Card links are built on this URL, and the engine refuses the whole pane over one bad link.
    if (typeof catalog.repository !== 'string' || !/^https:\/\/[^\s@]+$/.test(catalog.repository)) {
      throw new Error('repository is not an https URL')
    }
    if (new URL(catalog.repository).href !== catalog.repository) throw new Error('repository is not in normal URL form')
    return catalog
  } catch (error) {
    throw new Error(`catalog missing or invalid: ${String(error)}`)
  }
}

export const cardUrl = (catalog: { repository: string; package_version: string }, practice: { path: string }) =>
  `${catalog.repository}/blob/v${catalog.package_version}/${practice.path}`
export const repoUrl = (repo: { repo: string }) => `https://github.com/${repo.repo}`
