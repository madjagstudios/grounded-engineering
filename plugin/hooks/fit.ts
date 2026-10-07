import type { Catalog, Practice, SkillRepo } from './catalog'
import type { Adoption, Signals } from './signals'

type Bools = { [K in keyof Signals]: Signals[K] extends boolean ? K : never }[keyof Signals]

export function rankPractices(catalog: Catalog, signals: Signals, adoption: Adoption | null): { practice: Practice; why: string }[] {
  const on = (name: string) => signals[name as Bools] === true
  const adopted = new Set(adoption?.cards ?? [])
  const byId = new Map(catalog.practices.map((p) => [p.id, p]))
  const picked = new Map<string, string>()
  for (const rule of catalog.fit_rules) {
    const fires = rule.when.all.every(on) && (rule.when.any.length === 0 || rule.when.any.some(on)) && !rule.when.none.some(on)
    if (fires && !picked.has(rule.card) && !adopted.has(rule.card) && byId.has(rule.card)) picked.set(rule.card, rule.why)
  }
  return [...picked]
    .map(([id, why]) => ({ practice: byId.get(id)!, why }))
    .sort((a, b) => Number(b.practice.validation_status === 'validated') - Number(a.practice.validation_status === 'validated') || (a.practice.id < b.practice.id ? -1 : 1))
    .slice(0, 3)
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
