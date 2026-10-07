import type { PaneModel } from '../model'

// A press: the Client that made it (cid, made once per Client), its place in that Client's
// order (seq, counting up from 1), and the action it asks for.
export type Msg = { cid: string; seq: number; name: string; args: unknown[] }
// Presses the Client shows at once, before the plugin answers.
export const LOCAL_NAMES = new Set(['tab', 'select', 'search', 'category', 'tag', 'sort', 'toggleSignals', 'toggleLane'])

// The model as it will be once this press lands; used only for presses not yet acknowledged.
export function applyLocal(m: PaneModel, msg: Msg): PaneModel {
  const [a] = msg.args as [any]
  switch (msg.name) {
    case 'tab': return { ...m, screen: a, selected: null, query: '' }
    case 'select': return { ...m, selected: m.selected === a ? null : a }
    case 'search': return { ...m, query: a }
    case 'category': return { ...m, category: a }
    case 'tag': return { ...m, tag: a }
    case 'sort': return { ...m, sort: a }
    case 'toggleSignals': return { ...m, showSignals: !m.showSignals }
    case 'toggleLane': return { ...m, collapsed: { ...m.collapsed, [a]: !m.collapsed[a as 'fits' | 'all'] } }
    default: return m
  }
}

// A posted press is data from code, so it runs only when its name is one of the pane's actions
// and its arguments are what the pane gives that action: the right count, the right types,
// and for a skill the id of a card or repo in the catalog.
type Known = { practices: { id: string }[]; skill_repos: { id: string }[] }
const isString = (v: unknown): v is string => typeof v === 'string'
const oneOf = (v: unknown, options: readonly string[]): boolean => isString(v) && options.includes(v)
const ARGS: Record<string, (c: Known | null, a: unknown[]) => boolean> = {
  tab: (_, a) => a.length === 1 && oneOf(a[0], ['practices', 'skills']),
  select: (_, a) => a.length === 1 && isString(a[0]),
  search: (_, a) => a.length === 1 && isString(a[0]),
  category: (_, a) => a.length === 1 && isString(a[0]),
  tag: (_, a) => a.length === 1 && isString(a[0]),
  sort: (_, a) => a.length === 1 && oneOf(a[0], ['fit', 'name']),
  toggleSignals: (_, a) => a.length === 0,
  toggleLane: (_, a) => a.length === 1 && oneOf(a[0], ['fits', 'all']),
  adapt: (c, a) => a.length === 1 && isString(a[0]) && !!c?.practices.some((x) => x.id === a[0]),
  explain: (c, a) => a.length === 1 && isString(a[0]) && !!c?.skill_repos.some((x) => x.id === a[0]),
  link: (_, a) => a.length === 1 && isString(a[0]),
}
// A posted press's Client and number, or null when either is not what a Client makes; such a
// press cannot be acknowledged, so the plugin ignores it.
const CID = /^[\w-]{1,40}$/
export function pressOf(act: unknown): { cid: string; seq: number } | null {
  if (!act || typeof act !== 'object') return null
  const { cid, seq } = act as Record<string, unknown>
  return isString(cid) && CID.test(cid) && Number.isSafeInteger(seq) && (seq as number) > 0 ? { cid, seq: seq as number } : null
}
export function validAct(catalog: Known | null, act: unknown): act is Msg {
  if (!pressOf(act)) return false
  const { name, args } = act as Record<string, unknown>
  if (!isString(name) || !Array.isArray(args)) return false
  const check = Object.prototype.hasOwnProperty.call(ARGS, name) ? ARGS[name] : undefined
  return !!check && check(catalog, args)
}
