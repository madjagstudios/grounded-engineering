import type { PaneModel } from '../model'

export type Msg = { kind: 'act'; id: string; name: string; args: unknown[] }
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
