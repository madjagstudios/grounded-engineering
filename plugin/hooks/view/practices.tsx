import type { Catalog } from '../catalog'
import { cardUrl } from '../catalog'
import { rankPractices, matchesQuery } from '../fit'
import type { Adoption, Signals } from '../signals'
import { Card, type Ui } from './card'

export type PracticesProps = {
  ui: Ui & { Select: any }; catalog: Catalog; signals: Signals; adoption: Adoption | null; selected: string | null
  query: string; category: string; showSignals: boolean
  onSelect: (id: string) => void; onCategory: (c: string) => void; onToggleSignals: () => void; onAdapt: (id: string) => void
}

const STATUS = (s: string) => (s === 'validated' ? { badge: 'Validated', color: 'green' as const } : { badge: 'Needs review', color: 'yellow' as const })

export function Practices(p: PracticesProps) {
  const { Box, Text, Button, Select } = p.ui
  const gaps = rankPractices(p.catalog, p.signals, p.adoption, Infinity).length
  const fits = rankPractices(p.catalog, p.signals, p.adoption)
  const adopted = new Set(p.adoption?.cards ?? [])
  const summary = [p.signals.languages.join(', ') || 'no languages detected', p.signals.test_framework ?? 'no tests detected', `${gaps} gap${gaps === 1 ? '' : 's'}`].join(' · ')
  const visible = p.catalog.practices.filter((x) => (p.category === 'All' || x.category === p.category) && matchesQuery([x.title, x.pattern, x.id], p.query))
  // A fit says why it fits this repo; the full list sums each practice up instead.
  const model = (x: Catalog['practices'][number], calloutLabel: 'Why here' | 'In short', callout: string) => ({
    id: x.id, title: x.title, subtitle: adopted.has(x.id) ? 'Adopted through the CLI' : undefined,
    badge: STATUS(x.validation_status).badge, badgeColor: STATUS(x.validation_status).color, description: x.pattern,
    calloutLabel, callout, cautionLabel: 'Trade-off', caution: x.rationale,
    provenance: `${x.category} · sources ${x.source_ids.join(', ')} · ${x.id}`,
    primary: adopted.has(x.id) ? undefined : { label: 'Adapt to this repo', onPress: () => p.onAdapt(x.id) },
    links: [{ label: 'Evidence', href: cardUrl(p.catalog, x) }],
  })
  // The selection names one copy of a card (`fit-<id>` or `<id>`), so only that copy expands.
  const pick = (prefix: '' | 'fit-', id: string) => ({ keyPrefix: prefix, isSelected: p.selected === `${prefix}${id}`, onSelect: () => p.onSelect(`${prefix}${id}`) })
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text dimColor>{summary}</Text>
        <Button key="toggle-signals" plain onPress={p.onToggleSignals}>{p.showSignals ? 'Hide details' : 'Details'}</Button>
      </Box>
      {p.showSignals && p.catalog.signals.map((s) => <Text dimColor>{`${s.name}: ${JSON.stringify((p.signals as Record<string, unknown>)[s.name])}`}</Text>)}
      {p.adoption && <Text dimColor>{`Adopted: ${p.adoption.profile ?? 'custom'} · ${p.adoption.cards.length} of ${p.catalog.practices.length}`}</Text>}
      <Text bold>Fits this repo</Text>
      {fits.length === 0 && <Text>Your repo already covers the basics.</Text>}
      {fits.map((f) => Card({ ui: p.ui, model: model(f.practice, 'Why here', f.why), ...pick('fit-', f.practice.id) }))}
      <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
        <Text bold>All practices</Text>
        <Select key="category" value={p.category} options={[{ value: 'All', label: 'All' }, ...p.catalog.categories.map((c) => ({ value: c, label: c }))]} onSelect={p.onCategory} />
      </Box>
      {visible.length === 0 && <Text dimColor>No matches.</Text>}
      {visible.map((x) => Card({ ui: p.ui, model: model(x, 'In short', x.agent_snippet ?? x.pattern), ...pick('', x.id) }))}
      <Text dimColor>Want the whole pack, kept in sync? npx grounded-engineering adopt preview --profile ai-assisted</Text>
    </Box>
  )
}
