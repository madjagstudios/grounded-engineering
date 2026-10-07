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
import { Shell } from './view/shell'

const PANE = 'grounded'

const screenState = atom({ plugin: 'grounded-engineering', key: 'screen' } as const, 'practices' as GroundedScreen)
const selectedState = atom({ plugin: 'grounded-engineering', key: 'selected' } as const, null as string | null)
const queryState = atom({ plugin: 'grounded-engineering', key: 'query' } as const, '')
const categoryState = atom({ plugin: 'grounded-engineering', key: 'category' } as const, 'All')
const tagState = atom({ plugin: 'grounded-engineering', key: 'tag' } as const, 'All')
const sortState = atom({ plugin: 'grounded-engineering', key: 'sort' } as const, 'fit' as 'fit' | 'name')
const showSignalsState = atom({ plugin: 'grounded-engineering', key: 'showSignals' } as const, false)
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

async function openOn($: any, screen: 'practices' | 'skills', text: string) {
  await update($, screenState, () => screen)
  await update($, selectedState, () => null)
  await update($, queryState, () => '')
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
    const host = hostOf($)
    let catalog: Catalog | null = null
    let error: string | null = null
    if (catalogCache?.root === host.plugin.root) catalog = catalogCache.catalog
    else {
      try {
        catalog = await loadCatalog(host)
        catalogCache = { root: host.plugin.root, catalog }
      } catch (err) { error = (err as Error).message }
    }
    const [screen, selected, query, category, tag, sort, showSignals, storedSignals, storedAdoption] = await Promise.all([
      read($, screenState), read($, selectedState), read($, queryState), read($, categoryState), read($, tagState), read($, sortState), read($, showSignalsState), read($, signalsState), read($, adoptionState),
    ])
    const [signals, adoption] = storedSignals !== null
      ? [storedSignals, storedAdoption]
      : await Promise.all([readSignals(host), readAdoption(host)])
    // The plugin's skills run as commands, only from a Button's onPress.
    const runSkill = (skill: 'adapt' | 'explain', id: string) =>
      void $.command.run({ command: `grounded-engineering:${skill}`, args: id })
        .catch(() => $.ui.toast(`Could not start /grounded-engineering:${skill} ${id}`))
    return Shell({
      ui, bodyColumns: e.props.bodyColumns, catalog, error, screen, selected, query, category, tag, sort, showSignals, signals, adoption,
      on: {
        // Search belongs to the screen it was typed on, so a tab change clears it.
        tab: (id) => { void update($, screenState, () => id); void update($, selectedState, () => null); void update($, queryState, () => '') },
        search: (q) => void update($, queryState, () => q),
        select: (id) => void update($, selectedState, (cur) => (cur === id ? null : id)),
        category: (c) => void update($, categoryState, () => c),
        tag: (t) => void update($, tagState, () => t),
        sort: (v) => void update($, sortState, () => v),
        toggleSignals: () => void update($, showSignalsState, (v) => !v),
        adapt: (id) => runSkill('adapt', id),
        explain: (id) => runSkill('explain', id),
      },
    })
  })
}
