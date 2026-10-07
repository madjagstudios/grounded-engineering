import type { Register } from 'claude-code'
import { atom, read, update } from 'claude-code'
import { loadCatalog, type Host } from './catalog'
import { readAdoption, readSignals } from './signals'
import type { GroundedScreen, GroundedSignals } from '../types'
import { Shell } from './view/shell'

const PANE = 'grounded'

// The engine reads state only through atoms declared in this file, from references whose
// plugin and key are literals, so the state lives here and not in a module of its own.
const screenState = atom({ plugin: 'grounded-engineering', key: 'screen' } as const, 'practices' as GroundedScreen)
const selectedState = atom({ plugin: 'grounded-engineering', key: 'selected' } as const, null as string | null)
const queryState = atom({ plugin: 'grounded-engineering', key: 'query' } as const, '')
const categoryState = atom({ plugin: 'grounded-engineering', key: 'category' } as const, 'All')
const tagState = atom({ plugin: 'grounded-engineering', key: 'tag' } as const, 'All')
const sortState = atom({ plugin: 'grounded-engineering', key: 'sort' } as const, 'fit' as 'fit' | 'name')
const showSignalsState = atom({ plugin: 'grounded-engineering', key: 'showSignals' } as const, false)
const signalsState = atom({ plugin: 'grounded-engineering', key: 'signals' } as const, null as GroundedSignals | null)
const adoptionState = atom({ plugin: 'grounded-engineering', key: 'adoption' } as const, null as { profile: string | null; cards: string[] } | null)

// A hook must be a function literal, so each command names its own; the shared work is a
// function declared at the top of this file, the one place the engine follows `$` into.
async function openOn($: any, screen: 'practices' | 'skills', text: string) {
  const host: Host = { fs: { read: (p) => $.fs.read(p).then(String), exists: (p) => $.fs.exists(p), list: (p) => $.fs.list(p) }, plugin: { root: $.plugin.root } }
  await update($, screenState, () => screen)
  await update($, selectedState, () => null)
  await update($, queryState, () => '')
  await $.ui.open({ id: PANE, title: 'Grounded' })
  const [signals, adoption] = await Promise.all([readSignals(host), readAdoption(host)])
  await update($, signalsState, () => signals)
  await update($, adoptionState, () => adoption)
  return { text }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'grounded', description: 'Open Grounded Engineering: practices that fit this repo' })
    await $.command.register({ name: 'grounded-skills', description: 'Open Grounded Engineering: reviewed skill repos' })
    return next(e)
  })

  on('command.run', { command: 'grounded' }, async ($) => openOn($, 'practices', 'Grounded Engineering opened on Practices.'))
  on('command.run', { command: 'grounded-skills' }, async ($) => openOn($, 'skills', 'Grounded Engineering opened on Skill repos.'))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const host: Host = { fs: { read: (p) => $.fs.read(p).then(String), exists: (p) => $.fs.exists(p), list: (p) => $.fs.list(p) }, plugin: { root: $.plugin.root } }
    let catalog = null
    let error: string | null = null
    try { catalog = await loadCatalog(host) } catch (err) { error = (err as Error).message }
    const [screen, selected, query, category, tag, sort, showSignals, signals, adoption] = await Promise.all([
      read($, screenState), read($, selectedState), read($, queryState), read($, categoryState), read($, tagState), read($, sortState), read($, showSignalsState), read($, signalsState), read($, adoptionState),
    ])
    // Decision D4: the plugin's skills run as commands, only from a Button's onPress.
    const runSkill = (skill: 'adapt' | 'explain', id: string) => void $.command.run({ command: `grounded-engineering:${skill}`, args: id })
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
