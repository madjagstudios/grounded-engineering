import type { Catalog } from '../catalog'
import type { Adoption, Signals } from '../signals'
import { Practices } from './practices'
import { Skills } from './skills'

export type Handlers = {
  tab: (screen: 'practices' | 'skills') => void; search: (q: string) => void; select: (id: string) => void
  category: (c: string) => void; tag: (t: string) => void; sort: (s: 'fit' | 'name') => void
  toggleSignals: () => void; adapt: (id: string) => void; explain: (id: string) => void
}

export type ShellProps = {
  ui: any; bodyColumns: number | undefined; catalog: Catalog | null; error: string | null
  screen: 'practices' | 'skills'; selected: string | null; query: string; category: string; tag: string
  sort: 'fit' | 'name'; showSignals: boolean; signals: Signals | null; adoption: Adoption | null; on: Handlers
}

export function Shell(p: ShellProps) {
  const { Box, Text, Button, Input, Link } = p.ui
  if (!p.catalog) {
    return (
      <Box key="catalog-error">
        <Text color="red">{`${p.error ?? 'catalog missing or invalid'}. Reinstall the plugin: /plugin install grounded-engineering@grounded-engineering`}</Text>
      </Box>
    )
  }
  const catalog = p.catalog
  const tab = (id: 'practices' | 'skills', label: string) => (
    <Button key={`tab-${id}`} variant={p.screen === id ? 'primary' : 'secondary'} onPress={() => p.on.tab(id)}>{label}</Button>
  )
  return (
    <Box flexDirection="column" width={p.bodyColumns}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold>Grounded Engineering</Text>
        <Text dimColor>{`catalog v${catalog.package_version}`}</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        {tab('practices', `Practices ${catalog.practices.length}`)}
        {tab('skills', `Skill repos ${catalog.skill_repos.length}`)}
      </Box>
      <Input key="search" label={p.screen === 'practices' ? 'Search practices' : 'Search skill repos'} value={p.query} onInput={(v: string) => p.on.search(v)} onSubmit={(v: string) => p.on.search(v)} />
      {p.signals === null
        ? <Text dimColor>Reading this repository…</Text>
        : p.screen === 'practices'
          ? Practices({ ui: p.ui, catalog, signals: p.signals, adoption: p.adoption, selected: p.selected, query: p.query, category: p.category, showSignals: p.showSignals,
              onSelect: p.on.select, onCategory: p.on.category, onToggleSignals: p.on.toggleSignals, onAdapt: p.on.adapt })
          : Skills({ ui: p.ui, catalog, signals: p.signals, selected: p.selected, query: p.query, tag: p.tag, sort: p.sort,
              onSelect: p.on.select, onTag: p.on.tag, onSort: p.on.sort, onExplain: p.on.explain })}
      <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
        <Text dimColor>Reviewed by people · sources pinned · offline</Text>
        <Link href={catalog.repository}>Star us</Link>
      </Box>
    </Box>
  )
}
