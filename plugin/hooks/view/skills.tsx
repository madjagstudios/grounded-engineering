import type { Catalog } from '../catalog'
import { repoUrl } from '../catalog'
import { sortSkillRepos, matchesQuery } from '../fit'
import type { Signals } from '../signals'
import { Card, type Ui } from './card'

export type SkillsProps = {
  ui: Ui & { Select: any }; catalog: Catalog; signals: Signals; selected: string | null; query: string; tag: string
  sort: 'fit' | 'name'; onSelect: (id: string) => void; onTag: (t: string) => void; onSort: (s: 'fit' | 'name') => void; onExplain: (id: string) => void
}

const MORE = [
  { label: 'awesome-claude-skills (ComposioHQ)', href: 'https://github.com/ComposioHQ/awesome-claude-skills' },
  { label: 'awesome-claude-code-mods', href: 'https://github.com/karanb192/awesome-claude-code-mods' },
]

export function Skills(p: SkillsProps) {
  const { Box, Text, Link, Select } = p.ui
  const tags = [...new Set(p.catalog.skill_repos.flatMap((r) => r.tags))].sort()
  const repos = sortSkillRepos(p.catalog.skill_repos, p.signals, p.sort)
    .filter((r) => (p.tag === 'All' || r.tags.includes(p.tag)) && matchesQuery([r.name, r.repo, r.summary], p.query))
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold>Hand-picked skill repos</Text>
        <Box flexDirection="row" gap={1}>
          <Select key="tag" value={p.tag} options={[{ value: 'All', label: 'All' }, ...tags.map((t) => ({ value: t, label: t }))]} onSelect={p.onTag} />
          <Select key="sort" value={p.sort} options={[{ value: 'fit', label: 'Fit to this repo' }, { value: 'name', label: 'Name' }]} onSelect={(v: string) => p.onSort(v === 'name' ? 'name' : 'fit')} />
        </Box>
      </Box>
      {p.catalog.skill_repos.length === 0 && <Text>No skill repos are listed yet.</Text>}
      {repos.map((r) => Card({ ui: p.ui, isSelected: p.selected === r.id, onSelect: () => p.onSelect(r.id), model: {
        id: r.id, title: r.name, subtitle: `${r.repo.split('/')[0]} · ${r.license}`, badge: 'Reviewed', badgeColor: undefined,
        description: r.summary, calloutLabel: 'Best for', callout: r.tags.join(', '), cautionLabel: 'Watch out', caution: r.watch_out_for,
        provenance: `Reviewed ${r.reviewed_on} · pinned at ${r.pinned_commit.slice(0, 7)}`,
        primary: { label: 'Explain install', onPress: () => p.onExplain(r.id) },
        links: [{ label: 'Star on GitHub', href: repoUrl(r) }, { label: 'Open', href: repoUrl(r) }],
      } }))}
      <Text bold>Want more?</Text>
      {MORE.map((m) => <Link href={m.href}>{m.label}</Link>)}
      <Text dimColor>We link, never copy. Credit and stars go to the authors. Authors can ask to be removed.</Text>
    </Box>
  )
}
