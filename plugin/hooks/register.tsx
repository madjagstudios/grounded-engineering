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
import { slimCatalog, type Ack, type PaneModel } from './model'
import { paneScreen, linkLabel } from './screens'
import { pressOf, validAct } from './client/apply'

const PANE = 'grounded'
// Prints one of the pane's links in the transcript, where the desktop opens it; hidden from the menu.
const LINK_COMMAND = 'grounded-link'

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

// The parsed catalog and the plugin root it was read from. A hot reload starts this module fresh, which empties it.
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

// What the plugin has done with each desktop Client's presses, by Client id. Posts carry a
// Client's presses in order, so the highest number received and finished says it all. Kept for
// the 16 Clients that posted last; one dropped and posting again starts from nothing, and its
// presses received but not yet acknowledged to it would run again, so the bound sits far above
// the Clients one session draws (a Client drawn again gets a new id).
const CLIENTS = 16
const acks = new Map<string, Ack>()
function ackOf(cid: string): Ack {
  const ack = acks.get(cid) ?? { received: 0, done: 0 }
  acks.delete(cid)
  acks.set(cid, ack)
  if (acks.size > CLIENTS) acks.delete(acks.keys().next().value!)
  return ack
}
// Client presses run one after another, in the order they were made; see ui.message.
let clientWork: Promise<unknown> = Promise.resolve()

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
    signals, adoption, acks: Object.fromEntries([...acks].map(([cid, a]) => [cid, { ...a }])),
  }
}

// The plugin's skills run as commands, only from a press.
async function runSkill($: any, skill: 'adapt' | 'explain', id: string) {
  void $.command.run({ command: `grounded-engineering:${skill}`, args: id })
    .catch(() => $.ui.toast(`Could not start /grounded-engineering:${skill} ${id}`))
}

// The transcript line for a link the pane draws, or null.
async function linkLine($: any, url: unknown): Promise<string | null> {
  const { catalog } = await catalogFor($)
  if (!catalog || typeof url !== 'string') return null
  const label = linkLabel(catalog, url)
  return label ? `${label}: ${url}` : null
}

// The command is registered immediate, so it runs at once even mid-turn.
async function showLink($: any, url: unknown) {
  if (!(await linkLine($, url))) return
  void $.command.run({ command: LINK_COMMAND, args: url })
    .catch(() => $.ui.toast('Could not show the link'))
}

// Every action the pane can take, each returning a promise that resolves once its state is
// written. The ui.message hook awaits these for a Client's presses.
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
    link: (url: string) => showLink($, url),
  }
}

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
  // A request for a wider dock; a width the person dragged wins.
  await $.ui.open({ id: PANE, title: 'Grounded', columns: 100 })
  await refreshRepo($)
  return { text }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'grounded', description: 'Open Grounded Engineering: practices that fit this repo' })
    await $.command.register({ name: 'grounded-skills', description: 'Open Grounded Engineering: reviewed skill repos' })
    await $.command.register({ name: LINK_COMMAND, description: 'Print a Grounded Engineering link', argumentHint: '[url]', immediate: true })
    // A pane restored with the session can render before any command has run. A render that
    // runs before this finishes reads the repository itself.
    void refreshRepo($).catch(() => undefined)
    return next(e)
  })

  on('command.run', { command: 'grounded' }, async ($) => openOn($, 'practices', 'Grounded Engineering opened on Practices.'))
  on('command.run', { command: 'grounded-skills' }, async ($) => openOn($, 'skills', 'Grounded Engineering opened on Skill repos.'))
  on('command.run', { command: LINK_COMMAND }, async ($, e) => ({ text: (await linkLine($, e.args.trim())) ?? 'Not a link the Grounded pane shows.' }))
  on('command.describe', { command: LINK_COMMAND }, async ($, e, next) => next({ ...e, isHidden: true }))

  // Runs each press the Client posts once, in order; one that is not a valid action is acknowledged, not run.
  on('ui.message', async ($, e, next) => {
    if (e.element !== 'grounded-app') return next(e)
    const d = e.data as { kind?: string; acts?: unknown[] } | null
    const posted = d?.kind === 'acts' && Array.isArray(d.acts) ? d.acts : []
    const { catalog } = posted.length ? await catalogFor($) : { catalog: null }
    const table = actions($) as Record<string, (...args: any[]) => Promise<unknown>>
    let ran = false
    for (const a of posted) {
      const press = pressOf(a)
      if (!press) continue
      const ack = ackOf(press.cid)
      if (press.seq <= ack.received) continue
      ack.received = press.seq
      const act = validAct(catalog, a) ? a : null
      ran = true
      clientWork = clientWork.then(() => (act ? table[act.name]!(...act.args) : undefined)).catch(() => undefined)
        .then(() => { ack.done = press.seq })
    }
    if (ran) await clientWork
    return { props: await paneModel($) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    // On desktop the app paints a Pane's own redraws only on the next input; a Client paints itself.
    if (e.surface === 'desktop' && 'Client' in ui) {
      const { Client } = ui
      return <Client key="grounded-app" module="./client/app.tsx" props={await paneModel($)} width="100%" flexGrow={1} />
    }
    return paneScreen(ui, await paneModel($), handlers($) as any, PALETTE, e.props.bodyColumns ?? 0, 1)
  })
}
