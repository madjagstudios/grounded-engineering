import type { Catalog, FitRule, Practice, SkillRepo } from './catalog'
import type { Adoption, Signals } from './signals'

export type SlimPractice = Omit<Practice, 'body'>
export type SlimCatalog = {
  package_version: string; repository: string; categories: string[]
  signals: { name: string; description: string }[]
  practices: SlimPractice[]; skill_repos: SkillRepo[]; fit_rules: FitRule[]
}
export type Screen = 'practices' | 'skills'
// What the plugin has done with one Client's presses: the highest seq received, and the highest
// whose action has finished.
export type Ack = { received: number; done: number }
export type Acks = Record<string, Ack>
export type PaneModel = {
  catalog: SlimCatalog | null; error: string | null
  screen: Screen; selected: string | null; query: string; category: string; tag: string; sort: 'fit' | 'name'
  showSignals: boolean; collapsed: { fits: boolean; all: boolean }
  signals: Signals | null; adoption: Adoption | null
  acks: Acks
}

// What the pane draws; the card bodies and source list stay behind (Client props are size-bounded).
export function slimCatalog(c: Catalog): SlimCatalog {
  return {
    package_version: c.package_version, repository: c.repository, categories: c.categories,
    signals: c.signals.map(({ name, description }) => ({ name, description })),
    practices: c.practices.map(({ body, ...rest }) => rest),
    skill_repos: c.skill_repos, fit_rules: c.fit_rules,
  }
}
