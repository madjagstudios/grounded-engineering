// The pane's screens: pure functions of a plain-data model, the element table and handlers.
// The terminal draws them directly; on desktop the Client module draws the same screens.
import type { Palette } from './theme'
import { tile, laneHeader, badge, chip, option, field, shorten, room } from './tiles'
import { cardUrl, repoUrl } from './catalog'
import { rankPractices, sortSkillRepos, matchesQuery } from './fit'
import type { PaneModel, Screen, SlimCatalog, SlimPractice, SlimSkillRepo } from './model'

export const HANDLER_NAMES = ['tab', 'select', 'search', 'category', 'tag', 'sort', 'toggleSignals', 'toggleLane', 'adapt', 'explain', 'link'] as const

type Go = {
  tab: (s: Screen) => void; select: (key: string) => void; search: (q: string) => void
  category: (c: string) => void; tag: (t: string) => void; sort: (s: 'fit' | 'name') => void
  toggleSignals: () => void; toggleLane: (lane: 'fits' | 'all') => void
  adapt: (id: string) => void; explain: (id: string) => void
  link: (url: string) => void
}

// The other lists the skills screen points to; the terminal draws each label with a ›.
const MORE = [
  { label: 'awesome-claude-skills', href: 'https://github.com/ComposioHQ/awesome-claude-skills' },
  { label: 'awesome-claude-code-mods', href: 'https://github.com/karanb192/awesome-claude-code-mods' },
]

// Below this many columns the tabs take the whole header row and the title is left out.
const NARROW = 60

const PANE = 2
const SYMBOL = 2 // a row's status symbol and its gap
const OUTLINE = 4 // the outline and the label padding
const TILE = 4
const TERMINAL = 9 // the terminal's fixed overhead per row
const TERMINAL_TAGS = 8 // the terminal's room for a repo row's tags
// On desktop, titles are cut to one line; below WIDE columns the category, tags and badge give way.
const WIDE = 70
const outlined = (ui: any) => ui.outlinesTitles === true
const tight = (ui: any, columns: number) => outlined(ui) && columns > 0 && columns < WIDE

export function rowTitleRoom(ui: any, columns: number, scale: number, category: string): number {
  if (!outlined(ui)) return room(columns, TERMINAL + category.length, scale)
  return room(columns, PANE + SYMBOL + OUTLINE + (tight(ui, columns) ? 0 : category.length + 1), scale)
}

export function repoTitleRoom(ui: any, columns: number, scale: number, tags: string): number {
  if (!outlined(ui)) return room(columns, TERMINAL + TERMINAL_TAGS, scale)
  return room(columns, PANE + OUTLINE + (tight(ui, columns) ? 0 : tags.length + 1), scale)
}

export function tileTitleRoom(ui: any, columns: number, scale: number, badgeText: string): number {
  return room(columns, PANE + TILE + OUTLINE + (tight(ui, columns) ? 0 : badgeText.length + 1), scale)
}

// The links the pane draws, each with what the transcript says before it.
type LinkCatalog = { repository: string; package_version: string; practices: { id: string; path: string }[]; skill_repos: SlimSkillRepo[] }
export function linkLabel(c: LinkCatalog, url: string): string | null {
  const practice = c.practices.find((x) => cardUrl(c, x) === url)
  if (practice) return `Evidence for ${practice.id}`
  const repo = c.skill_repos.find((r) => repoUrl(r) === url)
  if (repo) return `${repo.name} on GitHub`
  if (url === c.repository) return 'Grounded Engineering on GitHub'
  const more = MORE.find((l) => l.href === url)
  return more ? more.label : null
}

const isValidated = (x: { validation_status: string }) => x.validation_status === 'validated'
const byline = (r: SlimSkillRepo) => `${r.featured ? 'Featured · ' : ''}${r.repo.split('/')[0]} · ${r.license}`

export function paneScreen(ui: any, m: PaneModel, go: Go, p: Palette, columns: number, scale: number) {
  const { Box, Text, Button } = ui
  if (!m.catalog) {
    return (
      <Box key="catalog-error" flexDirection="column">
        <Text color={p.failed.text}>{`${m.error ?? 'catalog missing or invalid'}. Reinstall the plugin: /plugin install grounded-engineering@grounded-engineering`}</Text>
      </Box>
    )
  }
  const c = m.catalog
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        {columns > 0 && columns < NARROW ? null : <Box flexGrow={1} flexShrink={1} minWidth={0}><Text bold wrap="truncate-end">Grounded Engineering</Text></Box>}
        <Box flexDirection="row" gap={1} flexShrink={0}>
          <Button key="tab-practices" hotkey="1" variant={m.screen === 'practices' ? 'primary' : 'secondary'} label={`Practices ${c.practices.length}`} onPress={() => go.tab('practices')} />
          <Button key="tab-skills" hotkey="2" variant={m.screen === 'skills' ? 'primary' : 'secondary'} label={`Skill repos ${c.skill_repos.length}`} onPress={() => go.tab('skills')} />
        </Box>
      </Box>
      {m.signals === null
        ? <Text color={p.dim}>Reading this repository…</Text>
        : m.screen === 'practices' ? practicesScreen(ui, m, c, go, p, columns, scale) : skillsScreen(ui, m, c, go, p, columns, scale)}
    </Box>
  )
}

function practicesScreen(ui: any, m: PaneModel, c: SlimCatalog, go: Go, p: Palette, columns: number, scale: number) {
  const { Box, Text, Button, Link } = ui
  const s = m.signals!
  const all = rankPractices(c, s, m.adoption, Infinity)
  const fits = all.slice(0, 3)
  const adopted = new Set(m.adoption?.cards ?? [])
  const visible = c.practices.filter((x) => (m.category === 'All' || x.category === m.category) && matchesQuery([x.title, x.pattern, x.id], m.query))
  const gapText = all.length === 0 ? 'no gaps' : `${all.length} gap${all.length === 1 ? '' : 's'}`
  const detected = [...s.languages, s.test_framework ?? (s.has_tests ? 'tests (framework unknown)' : 'no tests')].join(' · ')
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        <Box flexDirection="row" gap={1} flexShrink={1} minWidth={0} flexWrap="wrap">
          {chip(ui, p, all.length ? 'warn' : 'ok', gapText)}
          {chip(ui, p, 'neutral', `Detected: ${detected}`)}
          {m.adoption ? chip(ui, p, 'neutral', `Adopted: ${m.adoption.profile ?? 'custom'} · ${m.adoption.cards.length}`) : null}
        </Box>
        <Box flexShrink={0}><Button key="details" plain hotkey="d" label={m.showSignals ? 'Hide details' : 'Details ›'} onPress={() => go.toggleSignals()} /></Box>
      </Box>
      {m.showSignals ? (
        <Box key="signals" flexDirection="column">
          {c.signals.map((sig) => <Text color={p.dim} wrap="truncate-end">{`${sig.name}: ${JSON.stringify((s as Record<string, unknown>)[sig.name])}`}</Text>)}
          <Link href={c.repository}>☆ Star Grounded Engineering</Link>
        </Box>
      ) : null}
      {field(ui, p, 'search', 'Search practices', m.query, (v) => go.search(v))}
      {laneHeader(ui, p, 'warn', 'fits', '✋ Fits this repo', fits.length, !m.collapsed.fits, () => go.toggleLane('fits'))}
      {m.collapsed.fits ? null : fits.length === 0
        ? <Text color={p.dim}>Your repo already covers the basics.</Text>
        : <Box flexDirection="column" gap={1}>{fits.map((f) => practiceTile(ui, m, c, go, p, f.practice, `fit-${f.practice.id}`, 'Why here', f.why, adopted.has(f.practice.id), columns, scale, f.practice.agent_snippet ?? f.practice.pattern))}</Box>}
      {laneHeader(ui, p, 'neutral', 'all', 'All practices', visible.length, !m.collapsed.all, () => go.toggleLane('all'))}
      {m.collapsed.all ? null : (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" columnGap={2} rowGap={0} flexWrap="wrap">
            {option(ui, p, 'opt-cat-All', 'All', m.category === 'All', () => go.category('All'))}
            {c.categories.map((cat) => option(ui, p, `opt-cat-${cat}`, cat, m.category === cat, () => go.category(cat)))}
          </Box>
          {visible.length === 0 ? <Text color={p.dim}>No matches.</Text> : (
            <Box flexDirection="column">
              {visible.map((x) => m.selected === `all-${x.id}`
                ? practiceTile(ui, m, c, go, p, x, `all-${x.id}`, 'In short', x.agent_snippet ?? x.pattern, adopted.has(x.id), columns, scale)
                : practiceRow(ui, go, p, x, columns, scale))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

function practiceRow(ui: any, go: Go, p: Palette, x: SlimPractice, columns: number, scale: number) {
  const { Box, Text, Button } = ui
  const tone = isValidated(x) ? 'ok' : 'warn'
  const beside = !tight(ui, columns)
  const budget = rowTitleRoom(ui, columns, scale, x.category)
  return (
    <Box key={`row-${x.id}`} flexDirection="row" gap={1}>
      <Box flexShrink={0}><Text color={p[tone].text}>{isValidated(x) ? '✓' : '●'}</Text></Box>
      <Box flexGrow={1} flexShrink={1} minWidth={0}>
        <Button key={`open-all-${x.id}`} plain label={shorten(x.title, budget)} onPress={() => go.select(`all-${x.id}`)} />
      </Box>
      {beside ? <Box flexShrink={0}><Text color={p.dim} wrap="truncate-end">{x.category}</Text></Box> : null}
    </Box>
  )
}

// A tile's title and its badge: side by side, or on desktop below WIDE columns one under the other.
function tileTitle(ui: any, key: string, label: string, onPress: () => void, badgeText: string, badgeNode: unknown, columns: number, scale: number) {
  const { Box, Button } = ui
  const under = tight(ui, columns)
  const text = outlined(ui) ? shorten(label, tileTitleRoom(ui, columns, scale, badgeText)) : label
  const title = (
    <Box flexGrow={1} flexShrink={1} minWidth={0}>
      <Button key={key} plain label={text} onPress={onPress} />
    </Box>
  )
  return under
    ? <Box flexDirection="column">{title}{badgeNode}</Box>
    : <Box flexDirection="row" gap={1}>{title}{badgeNode}</Box>
}

function practiceTile(ui: any, m: PaneModel, c: SlimCatalog, go: Go, p: Palette, x: SlimPractice, key: string, calloutLabel: string, callout: string, isAdopted: boolean, columns: number, scale: number, summary: string | null = null) {
  const { Box, Text, Button, Link } = ui
  const isOpen = m.selected === key
  const tone = isValidated(x) ? 'ok' : 'warn'
  const badgeText = isValidated(x) ? '✓ Validated' : '● Needs review'
  return tile(ui, p, isOpen ? 'accent' : 'neutral', `tile-${key}`, [
    tileTitle(ui, `open-${key}`, x.title, () => go.select(key), badgeText, badge(ui, p, tone, badgeText), columns, scale),
    isAdopted ? <Text color={p.dim}>Adopted through the CLI</Text> : null,
    // What the practice is, before it opens; the opened tile shows its pattern and trade-off instead.
    summary && !isOpen ? <Text color={p.dim}>{`In short: ${summary}`}</Text> : null,
    <Text><Text bold>{`${calloutLabel}: `}</Text>{callout}</Text>,
    isOpen ? <Text color={p.dim}>{x.pattern}</Text> : null,
    isOpen ? <Text color={p.dim}><Text color={p.warn.text}>! </Text>{`Trade-off: ${x.rationale}`}</Text> : null,
    isOpen ? <Text color={p.dim} wrap="truncate-end">{`${x.category} · ${x.source_ids.join(', ')} · ${x.id}`}</Text> : null,
    isOpen ? (
      <Box flexDirection="row" columnGap={2} rowGap={0} flexWrap="wrap">
        {isAdopted ? null : <Button key={`primary-${key}`} variant="primary" hotkey="a" label="Adapt to this repo" onPress={() => go.adapt(x.id)} />}
        <Link href={cardUrl(c, x)}>Evidence ›</Link>
      </Box>
    ) : null,
  ])
}

function repoRow(ui: any, go: Go, p: Palette, r: SlimSkillRepo, columns: number, scale: number) {
  const { Box, Text, Button } = ui
  const tags = `${r.featured ? 'Featured · ' : ''}${r.tags.join(', ')}`
  const beside = !tight(ui, columns)
  const budget = repoTitleRoom(ui, columns, scale, tags)
  return (
    <Box key={`row-repo-${r.id}`} flexDirection="row" gap={1}>
      <Box flexGrow={1} flexShrink={1} minWidth={0}>
        <Button key={`open-repo-${r.id}`} plain label={shorten(r.name, budget)} onPress={() => go.select(`repo-${r.id}`)} />
      </Box>
      {beside ? <Box flexShrink={0}><Text color={p.dim} wrap="truncate-end">{tags}</Text></Box> : null}
    </Box>
  )
}

function skillsScreen(ui: any, m: PaneModel, c: SlimCatalog, go: Go, p: Palette, columns: number, scale: number) {
  const { Box, Text, Button, Link } = ui
  const tags = [...new Set(c.skill_repos.flatMap((r) => r.tags))].sort()
  const repos = sortSkillRepos(c.skill_repos, m.signals!, m.sort)
    .filter((r) => (m.tag === 'All' || r.tags.includes(m.tag)) && matchesQuery([r.name, r.repo, r.summary], m.query))
  return (
    <Box flexDirection="column" gap={1}>
      {field(ui, p, 'search', 'Search skill repos', m.query, (v) => go.search(v))}
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        <Box flexShrink={1} minWidth={0}><Text bold wrap="truncate-end">{`Reviewed skill repos ${c.skill_repos.length}`}</Text></Box>
        <Box flexDirection="row" gap={2} flexShrink={0}>
          {option(ui, p, 'opt-sort-fit', 'Fit', m.sort === 'fit', () => go.sort('fit'))}
          {option(ui, p, 'opt-sort-name', 'Name', m.sort === 'name', () => go.sort('name'))}
        </Box>
      </Box>
      {tags.length ? (
        <Box flexDirection="row" columnGap={2} rowGap={0} flexWrap="wrap">
          {option(ui, p, 'opt-tag-All', 'All', m.tag === 'All', () => go.tag('All'))}
          {tags.map((t) => option(ui, p, `opt-tag-${t}`, t, m.tag === t, () => go.tag(t)))}
        </Box>
      ) : null}
      {c.skill_repos.length === 0 ? <Text color={p.dim}>No skill repos are listed yet.</Text>
        : repos.length === 0 ? <Text color={p.dim}>No matches.</Text>
        : (
          <Box flexDirection="column" gap={1}>
            {repos.map((r) => m.selected === `repo-${r.id}` ? tile(ui, p, 'accent', `tile-repo-${r.id}`, [
              tileTitle(ui, `open-repo-${r.id}`, r.name, () => go.select(`repo-${r.id}`), byline(r), <Text color={p.dim} wrap="truncate-end">{byline(r)}</Text>, columns, scale),
              <Text>{r.summary}</Text>,
              <Text color={p.dim}><Text color={p.warn.text}>! </Text>{`Watch out: ${r.watch_out_for}`}</Text>,
              <Text color={p.dim} wrap="truncate-end">{`Reviewed ${r.reviewed_on} · pinned at ${r.pinned_commit.slice(0, 7)}`}</Text>,
              <Box flexDirection="row" columnGap={2} rowGap={0} flexWrap="wrap">
                <Button key={`primary-repo-${r.id}`} variant="primary" hotkey="a" label="Explain install" onPress={() => go.explain(r.id)} />
                <Link href={repoUrl(r)}>☆ Star on GitHub</Link>
              </Box>,
            ]) : repoRow(ui, go, p, r, columns, scale))}
          </Box>
        )}
      <Text bold>Want more?</Text>
      {MORE.map((l) => <Link href={l.href}>{`${l.label} ›`}</Link>)}
      <Text color={p.dim}>Authors can ask to be removed.</Text>
    </Box>
  )
}
