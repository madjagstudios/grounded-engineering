// Engine rules this file follows:
// - State atoms are declared here, as top-level consts with a literal plugin and key.
// - The engine does not follow `$` across an import, so every function that takes `$` is in this file.
// - Each hook passed to on() is a function literal.
// - A render never writes state.

import type { Register } from 'claude-code'
import { atom, read, update } from 'claude-code'
import { loadCatalog, type Catalog, type Host } from './catalog'
import { readAdoption, readSignals } from './signals'
import type { GroundedScreen, GroundedSignals } from '../types'
import { PALETTE } from './theme'
import { slimCatalog, type PaneModel } from './model'
import { paneScreen } from './screens'

const PANE = 'grounded'

const screenState = atom({ plugin: 'grounded-engineering', key: 'screen' } as const, 'practices' as GroundedScreen)
const selectedState = atom({ plugin: 'grounded-engineering', key: 'selected' } as const, null as string | null)
const queryState = atom({ plugin: 'grounded-engineering', key: 'query' } as const, '')
const categoryState = atom({ plugin: 'grounded-engineering', key: 'category' } as const, 'All')
const tagState = atom({ plugin: 'grounded-engineering', key: 'tag' } as const, 'All')
const sortState = atom({ plugin: 'grounded-engineering', key: 'sort' } as const, 'fit' as 'fit' | 'name')
const showSignalsState = atom({ plugin: 'grounded-engineering', key: 'showSignals' } as const, false)
const collapsedState = atom({ plugin: 'grounded-engineering', key: 'collapsed' } as const, { fits: false, all: false } as { fits: boolean; all: boolean })
const signalsState = atom({ plugin: 'grounded-engineering', key: 'signals' } as const, null as GroundedSignals | null)
const adoptionState = atom({ plugin: 'grounded-engineering', key: 'adoption' } as const, null as { profile: string | null; cards: string[] } | null)

// The parsed catalog and the plugin root it was read from. A render reuses it instead of
// parsing the file again. A hot reload starts this module fresh, which empties it.
let catalogCache: { root: string; catalog: Catalog } | null = null

function hostOf($: any): Host {
  return { fs: { read: (p) => $.fs.read(p).then(String), exists: (p) => $.fs.exists(p), list: (p) => $.fs.list(p) }, plugin: { root: $.plugin.root } }
}

async function refreshRepo($: any) {
  const host = hostOf($)
  const [signals, adoption] = await Promise.all([readSignals(host), readAdoption(host)])
  await update($, signalsState, () => signals)
  await update($, adoptionState, () => adoption)
}

async function catalogFor($: any): Promise<{ catalog: Catalog | null; error: string | null }> {
  const host = hostOf($)
  if (catalogCache?.root === host.plugin.root) return { catalog: catalogCache.catalog, error: null }
  try {
    const catalog = await loadCatalog(host)
    catalogCache = { root: host.plugin.root, catalog }
    return { catalog, error: null }
  } catch (err) { return { catalog: null, error: (err as Error).message } }
}

// Module state for the desktop Client.
const acked: string[] = []
const seen: string[] = []

// Everything the pane draws, as plain data: the terminal draws it, the desktop Client receives it.
async function paneModel($: any): Promise<PaneModel> {
  const { catalog, error } = await catalogFor($)
  const [screen, selected, query, category, tag, sort, showSignals, collapsed, storedSignals, storedAdoption] = await Promise.all([
    read($, screenState), read($, selectedState), read($, queryState), read($, categoryState), read($, tagState), read($, sortState),
    read($, showSignalsState), read($, collapsedState), read($, signalsState), read($, adoptionState),
  ])
  const host = hostOf($)
  const [signals, adoption] = storedSignals !== null ? [storedSignals, storedAdoption] : await Promise.all([readSignals(host), readAdoption(host)])
  return {
    catalog: catalog ? slimCatalog(catalog) : null, error, screen, selected, query, category, tag, sort, showSignals, collapsed,
    signals, adoption, acked: acked.slice(-50), seen: seen.slice(-100),
  }
}

// The plugin's skills run as commands, only from a press.
async function runSkill($: any, skill: 'adapt' | 'explain', id: string) {
  void $.command.run({ command: `grounded-engineering:${skill}`, args: id })
    .catch(() => $.ui.toast(`Could not start /grounded-engineering:${skill} ${id}`))
}

// Every action the pane can take, each returning its promise; the desktop Client awaits them.
function actions($: any) {
  return {
    // Search belongs to the screen it was typed on, so a tab change clears it.
    tab: (s: 'practices' | 'skills') => Promise.all([update($, screenState, () => s), update($, selectedState, () => null), update($, queryState, () => '')]),
    select: (key: string) => update($, selectedState, (cur) => (cur === key ? null : key)),
    search: (q: string) => update($, queryState, () => q),
    category: (c: string) => update($, categoryState, () => c),
    tag: (t: string) => update($, tagState, () => t),
    sort: (v: 'fit' | 'name') => update($, sortState, () => v),
    toggleSignals: () => update($, showSignalsState, (v) => !v),
    toggleLane: (lane: 'fits' | 'all') => update($, collapsedState, (cur) => ({ ...cur, [lane]: !cur[lane] })),
    adapt: (id: string) => runSkill($, 'adapt', id),
    explain: (id: string) => runSkill($, 'explain', id),
  }
}

// The terminal draws the screens directly and does not wait on an action.
function handlers($: any) {
  const a = actions($) as Record<string, (...args: any[]) => Promise<unknown>>
  const out: Record<string, (...args: any[]) => void> = {}
  for (const name of Object.keys(a)) out[name] = (...args: any[]) => { void a[name]!(...args).catch(() => undefined) }
  return out
}

async function openOn($: any, screen: 'practices' | 'skills', text: string) {
  await update($, screenState, () => screen)
  await update($, selectedState, () => null)
  await update($, queryState, () => '')
  await update($, collapsedState, () => ({ fits: false, all: false }))
  await $.ui.open({ id: PANE, title: 'Grounded' })
  await refreshRepo($)
  return { text }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'grounded', description: 'Open Grounded Engineering: practices that fit this repo' })
    await $.command.register({ name: 'grounded-skills', description: 'Open Grounded Engineering: reviewed skill repos' })
    // A pane restored with the session can render before any command has run. This refresh
    // is not awaited, so the session starts without waiting for it, and a render that runs
    // before it finishes reads the repository itself.
    void refreshRepo($).catch(() => undefined)
    return next(e)
  })

  on('command.run', { command: 'grounded' }, async ($) => openOn($, 'practices', 'Grounded Engineering opened on Practices.'))
  on('command.run', { command: 'grounded-skills' }, async ($) => openOn($, 'skills', 'Grounded Engineering opened on Skill repos.'))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    return paneScreen(ui, await paneModel($), handlers($) as any, PALETTE, e.props.bodyColumns ?? 0, 1)
  })
}
