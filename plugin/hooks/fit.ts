import type { Catalog, Practice, SkillRepo } from './catalog'
import { SIGNAL_NAMES, type Adoption, type Signals } from './signals'

type Bools = { [K in keyof Signals]: Signals[K] extends boolean ? K : never }[keyof Signals]

// The pane lists the first `limit` fits; its gap count asks for them all (`Infinity`).
export function rankPractices(catalog: Catalog, signals: Signals, adoption: Adoption | null, limit = 3): { practice: Practice; why: string }[] {
  const on = (name: string) => signals[name as Bools] === true
  const adopted = new Set(adoption?.cards ?? [])
  const byId = new Map(catalog.practices.map((p) => [p.id, p]))
  const picked = new Map<string, string>()
  const known = new Set<string>(SIGNAL_NAMES)
  for (const rule of catalog.fit_rules) {
    // A rule naming a signal this plugin does not read cannot be judged, so it never fires.
    if (![...rule.when.all, ...rule.when.any, ...rule.when.none].every((name) => known.has(name))) continue
    const fires = rule.when.all.every(on) && (rule.when.any.length === 0 || rule.when.any.some(on)) && !rule.when.none.some(on)
    if (fires && !picked.has(rule.card) && !adopted.has(rule.card)) picked.set(rule.card, rule.why)
  }
  return [...picked]
    .map(([id, why]) => ({ practice: byId.get(id)!, why }))
    .sort((a, b) => Number(b.practice.validation_status === 'validated') - Number(a.practice.validation_status === 'validated') || (a.practice.id < b.practice.id ? -1 : 1))
    .slice(0, limit)
}

const TAG_SIGNALS = new Map<string, (s: Signals) => boolean>([
  ['typescript', (s) => s.languages.includes('typescript')],
  ['python', (s) => s.languages.includes('python')],
  ['testing', (s) => s.has_tests],
  ['devops', (s) => s.has_ci],
])

export function sortSkillRepos(repos: SkillRepo[], signals: Signals, mode: 'fit' | 'name'): SkillRepo[] {
  const score = (r: SkillRepo) => r.tags.filter((t) => TAG_SIGNALS.get(t)?.(signals)).length
  return [...repos].sort((a, b) => (mode === 'fit' ? score(b) - score(a) : 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

export function matchesQuery(text: string[], query: string): boolean {
  const q = query.trim().toLowerCase()
  return q === '' || text.some((t) => t.toLowerCase().includes(q))
}
