import { test, expect } from 'claude-code/testing'
import { shorten, room } from './tiles'
import { slimCatalog, type PaneModel } from './model'
import { HANDLER_NAMES, rowTitleRoom, tileTitleRoom, repoTitleRoom, linkLabel } from './screens'
import { cardUrl } from './catalog'
import { ackOf, enqueue, nextPost, starting, unfinished, unseen, RESEND } from './client/outbox'
import { applyLocal, pressOf, validAct, LOCAL_NAMES, type Msg } from './client/apply'
import { FIXTURE_CATALOG } from './test-support'

test('shorten keeps text that fits and cuts with an ellipsis when it does not', async () => {
  expect(shorten('Bound delegated work', 40)).toBe('Bound delegated work')
  expect(shorten('Gate network egress from agent-run work', 20)).toBe('Gate network egress…')
  expect(shorten('anything at all here', 0)).toBe('anything at all here')
})

test('room never goes negative and scales with the cell width', async () => {
  expect(room(60, 12, 1)).toBe(48)
  expect(room(60, 12, 1.25)).toBe(60)
  expect(room(10, 20, 1.25)).toBe(0)
  expect(room(0, 12, 1)).toBe(0)
})

const DESKTOP = { outlinesTitles: true }
const TERMINAL = {}
const CHARS = 1.25
const LEAN = 'Keep skill entrypoints lean'

test('a desktop row title gets what the row leaves: symbol, outline and pane padding only', async () => {
  // Below 70 columns the category gives way, so the title has the row to itself.
  expect(rowTitleRoom(DESKTOP, 33, CHARS, 'Agent & Skill Design')).toBe(31)
  expect(rowTitleRoom(DESKTOP, 45, CHARS, 'Agent & Skill Design')).toBe(46)
  // At 140 columns the category sits beside the title and is paid for in cells.
  expect(rowTitleRoom(DESKTOP, 140, CHARS, 'Agent & Skill Design')).toBe(138)
  expect(rowTitleRoom(DESKTOP, 140, CHARS, 'Verification')).toBe(148)
  for (const columns of [33, 45]) expect(shorten(LEAN, rowTitleRoom(DESKTOP, columns, CHARS, 'Verification'))).toBe(LEAN)
})

test('a desktop tile title gets what its border, padding and badge leave', async () => {
  expect(tileTitleRoom(DESKTOP, 33, CHARS, '✓ Validated')).toBe(28)
  expect(tileTitleRoom(DESKTOP, 45, CHARS, '✓ Validated')).toBe(43)
  expect(tileTitleRoom(DESKTOP, 140, CHARS, '✓ Validated')).toBe(147)
  expect(tileTitleRoom(DESKTOP, 140, CHARS, '● Needs review')).toBe(143)
  for (const columns of [33, 45]) expect(shorten(LEAN, tileTitleRoom(DESKTOP, columns, CHARS, '✓ Validated'))).toBe(LEAN)
})

test('a desktop skill repo title gets the row less its outline, and its tags only when wide', async () => {
  expect(repoTitleRoom(DESKTOP, 33, CHARS, 'typescript, testing')).toBe(33)
  expect(repoTitleRoom(DESKTOP, 140, CHARS, 'typescript, testing')).toBe(142)
})

test('terminal title budgets', async () => {
  expect(rowTitleRoom(TERMINAL, 80, 1, 'Verification')).toBe(59)
  expect(rowTitleRoom(TERMINAL, 80, 1, 'Agent & Skill Design')).toBe(51)
  expect(rowTitleRoom(TERMINAL, 40, 1, 'Agent & Skill Design')).toBe(11)
  expect(repoTitleRoom(TERMINAL, 80, 1, 'typescript')).toBe(63)
})

test('nothing a budget lets through is longer than the budget, and a budget of 10 or less cuts nothing', async () => {
  const titles = [LEAN, 'Write discriminating skill triggers', 'Confine agent-executed commands in an OS sandbox', 'Gate network egress from agent-run work', 'Inspect the repository before changing it']
  for (const columns of [33, 45, 140]) {
    for (const t of titles) {
      const budget = rowTitleRoom(DESKTOP, columns, CHARS, 'Agent & Skill Design')
      if (t.length > budget) expect(shorten(t, budget).length).toBeLessThanOrEqual(budget)
      const tb = tileTitleRoom(DESKTOP, columns, CHARS, '● Needs review')
      if (t.length > tb) expect(shorten(t, tb).length).toBeLessThanOrEqual(tb)
    }
  }
  expect(shorten('A title that is longer than ten', 10)).toBe('A title that is longer than ten')
})

test('the slim catalog drops card bodies and sources and stays small', async () => {
  const slim = slimCatalog(FIXTURE_CATALOG)
  expect('sources' in slim).toBe(false)
  expect(slim.practices.every((p) => !('body' in p))).toBe(true)
  expect(slim.practices.length).toBe(FIXTURE_CATALOG.practices.length)
})

const act = (seq: number, name: string, ...args: unknown[]): Msg => ({ cid: 'c1', seq, name, args })

test('the outbox keeps presses in order and a newer search replaces an unsent older one', async () => {
  let box: Msg[] = []
  box = enqueue(box, act(1, 'search', 'a'))
  box = enqueue(box, act(2, 'select', 'fit-X'))
  box = enqueue(box, act(3, 'search', 'ab'))
  expect(box.map((m) => m.seq)).toEqual([2, 3])
})

test('every post carries all unreceived presses, resends after a while, and syncs when empty', async () => {
  const a = act(1, 'adapt', 'GE-AS-004')
  const b = act(2, 'select', 'fit-GE-AS-004')
  let r = nextPost([a], { syncDue: true, sentKey: '', sinceSend: 0 })
  expect(r.post).toEqual({ kind: 'acts', acts: [a] })
  r = nextPost([a, b], r.s)
  expect((r.post as { acts: Msg[] }).acts.map((m) => m.seq)).toEqual([1, 2])
  r = nextPost([a, b], r.s)
  expect(r.post).toBe(null)
  let s = r.s
  for (let i = 1; i < RESEND; i++) s = nextPost([a, b], s).s
  expect(nextPost([a, b], s).post?.kind).toBe('acts')
  r = nextPost([], { syncDue: true, sentKey: '1,2', sinceSend: 0 })
  expect(r.post).toEqual({ kind: 'sync' })
  expect(nextPost([], r.s).post).toBe(null)
})

test('a Client posts a press until the plugin has received it, and shows it until its action has finished', async () => {
  const presses = [act(1, 'adapt', 'GE-AS-004'), act(3, 'search', 'ab'), act(4, 'toggleSignals')]
  const ack = { received: 3, done: 1 }
  expect(unseen(presses, ack)).toEqual([presses[2]])
  expect(unfinished(presses, ack)).toEqual([presses[1], presses[2]])
  // A gap where a replaced search was never sent is passed over like any received press.
  expect(unseen(presses, { received: 4, done: 4 })).toEqual([])
  expect(unfinished(presses, { received: 4, done: 4 })).toEqual([])
  // However many presses one answer covers, it clears them all.
  const many = Array.from({ length: 500 }, (_, i) => act(i + 1, 'toggleSignals'))
  expect(unfinished(many, { received: 500, done: 499 })).toEqual([many[499]])
})

test('a Client the plugin names nothing for has had nothing received or finished', async () => {
  const presses = [act(1, 'tab', 'skills')]
  expect(ackOf(undefined, 'c1')).toEqual({ received: 0, done: 0 })
  expect(ackOf({ other: { received: 9, done: 9 } }, 'c1')).toEqual({ received: 0, done: 0 })
  expect(ackOf({ c1: { received: 2, done: 1 } }, 'c1')).toEqual({ received: 2, done: 1 })
  expect(unseen(presses, ackOf({ other: { received: 9, done: 9 } }, 'c1'))).toEqual(presses)
})

test('Starting… shows while a skill press has not finished', async () => {
  expect(starting([act(1, 'select', 'fit-A'), act(2, 'adapt', 'GE-AS-004')])).toBe(true)
  expect(starting([act(2, 'explain', 'GE-SR-002')])).toBe(true)
  expect(starting([act(1, 'select', 'fit-A')])).toBe(false)
  expect(starting(unfinished([act(2, 'adapt', 'GE-AS-004'), act(3, 'tab', 'skills')], { received: 3, done: 2 }))).toBe(false)
})

test('applyLocal applies each press the Client shows at once, and select toggles', async () => {
  const m = paneModelOf(FIXTURE_CATALOG)
  expect(applyLocal({ ...m, selected: 'fit-A', query: 'q' }, act(1, 'tab', 'skills'))).toMatchObject({ screen: 'skills', selected: null, query: '' })
  expect(applyLocal(m, act(1, 'select', 'fit-A')).selected).toBe('fit-A')
  expect(applyLocal({ ...m, selected: 'fit-A' }, act(1, 'select', 'fit-A')).selected).toBe(null)
  expect(applyLocal(m, act(1, 'search', 'sandbox')).query).toBe('sandbox')
  expect(applyLocal(m, act(1, 'category', 'Verification')).category).toBe('Verification')
  expect(applyLocal(m, act(1, 'tag', 'testing')).tag).toBe('testing')
  expect(applyLocal(m, act(1, 'sort', 'name')).sort).toBe('name')
  expect(applyLocal(m, act(1, 'toggleSignals')).showSignals).toBe(true)
  expect(applyLocal(m, act(1, 'toggleLane', 'fits')).collapsed).toEqual({ fits: true, all: false })
  expect(applyLocal(m, act(1, 'adapt', 'GE-AS-004'))).toBe(m)
  expect([...LOCAL_NAMES].every((n) => (HANDLER_NAMES as readonly string[]).includes(n))).toBe(true)
})

test('validAct accepts each action with the arguments the pane gives it, and nothing else', async () => {
  const c = FIXTURE_CATALOG
  const ok = [
    act(1, 'tab', 'practices'), act(1, 'tab', 'skills'), act(1, 'select', 'fit-GE-AS-004'), act(1, 'search', ''), act(1, 'search', 'sandbox'),
    act(1, 'category', 'All'), act(1, 'category', 'Verification'), act(1, 'tag', 'All'), act(1, 'tag', 'testing'),
    act(1, 'sort', 'fit'), act(1, 'sort', 'name'), act(1, 'toggleSignals'), act(1, 'toggleLane', 'fits'), act(1, 'toggleLane', 'all'),
    act(1, 'adapt', 'GE-AS-004'), act(1, 'explain', 'GE-SR-002'), act(1, 'link', 'https://example.net/anything'),
  ]
  for (const m of ok) expect(validAct(c, m)).toBe(true)
  const bad: unknown[] = [
    null, 'act', 7, {}, { name: 'tab', args: ['skills'] },
    { cid: 'c1', seq: 1, name: 'tab' }, { cid: 'c1', seq: 1, name: 'tab', args: 'skills' },
    act(1, 'nope', 'x'), act(1, 'constructor', 'x'), act(1, 'toString'), act(1, '__proto__'),
    act(1, 'tab', 'settings'), act(1, 'tab'), act(1, 'tab', 'skills', 'extra'),
    act(1, 'select', 7), act(1, 'select', null), act(1, 'select'),
    act(1, 'search', 7), act(1, 'search', null), act(1, 'search', { toString: 1 }), act(1, 'search'),
    act(1, 'category', 3), act(1, 'tag', ['x']),
    act(1, 'sort', 'size'), act(1, 'toggleLane', 'both'), act(1, 'toggleLane', '__proto__'),
    act(1, 'toggleSignals', true),
    act(1, 'adapt', 'GE-NOPE-001'), act(1, 'adapt', 'GE-SR-002'), act(1, 'adapt', 4), act(1, 'adapt'),
    act(1, 'explain', 'GE-AS-004'), act(1, 'explain', 'x'), act(1, 'explain', null),
    act(1, 'link', 7), act(1, 'link', undefined), act(1, 'link'),
  ]
  for (const m of bad) expect(validAct(c, m)).toBe(false)
})

test('a press names its Client by a short id and its place by a positive whole number, or it is not one', async () => {
  expect(pressOf(act(1, 'tab', 'skills'))).toEqual({ cid: 'c1', seq: 1 })
  expect(pressOf({ ...act(1, 'tab'), cid: 'lmn0pq-x7k2ab', seq: Number.MAX_SAFE_INTEGER })).toEqual({ cid: 'lmn0pq-x7k2ab', seq: Number.MAX_SAFE_INTEGER })
  const notPresses: unknown[] = [
    null, 'act', {}, { seq: 1, name: 'tab', args: ['skills'] }, { cid: 'c1', name: 'tab', args: ['skills'] },
    { ...act(1, 'tab', 'skills'), cid: '' }, { ...act(1, 'tab', 'skills'), cid: 'x'.repeat(41) }, { ...act(1, 'tab', 'skills'), cid: 'a b' },
    { ...act(1, 'tab', 'skills'), cid: 7 }, { ...act(1, 'tab', 'skills'), cid: ['c1'] },
    act(0, 'tab', 'skills'), act(-1, 'tab', 'skills'), act(1.5, 'tab', 'skills'), act(Number.NaN, 'tab', 'skills'), act(2 ** 53, 'tab', 'skills'),
    { ...act(1, 'tab', 'skills'), seq: '1' }, { ...act(1, 'tab', 'skills'), seq: null },
  ]
  for (const p of notPresses) {
    expect(pressOf(p)).toBe(null)
    expect(validAct(FIXTURE_CATALOG, p)).toBe(false)
  }
})

test('validAct refuses adapt and explain when there is no catalog to check the id against', async () => {
  expect(validAct(null, act(1, 'adapt', 'GE-AS-004'))).toBe(false)
  expect(validAct(null, act(1, 'explain', 'GE-SR-002'))).toBe(false)
  expect(validAct(null, act(1, 'tab', 'skills'))).toBe(true)
})

test('linkLabel names only the links the pane draws, and rejects near-misses', async () => {
  const c = FIXTURE_CATALOG
  const card = cardUrl(c, c.practices[0]!)
  expect(linkLabel(c, card)).toBe('Evidence for GE-AS-004')
  expect(linkLabel(c, 'https://github.com/example/alpha-skills')).toBe('alpha-skills on GitHub')
  expect(linkLabel(c, c.repository)).toBe('Grounded Engineering on GitHub')
  expect(linkLabel(c, 'https://github.com/ComposioHQ/awesome-claude-skills')).toBe('awesome-claude-skills')
  expect(linkLabel(c, 'https://github.com/karanb192/awesome-claude-code-mods')).toBe('awesome-claude-code-mods')
  for (const near of [`${card}#x`, `${card}/extra`, `${card} `, `${c.repository}/`, `${c.repository}?x=1`, 'https://github.com/ComposioHQ/awesome-claude-skills/', 'https://github.com/ComposioHQ/awesome-claude-skills#x', 'https://example.net/forged', '']) {
    expect(linkLabel(c, near)).toBe(null)
  }
})

test('the Client model built from a catalog larger than the shipped one stays under 60,000 characters', async () => {
  // The kit cannot read the shipped catalog (17 practices, about 17,000 characters slim), so this
  // one is built larger: more practices, each with longer text than any shipped card, a fit rule
  // for each, and thirteen described signals.
  const practices = Array.from({ length: 24 }, (_, i) => ({ ...FIXTURE_CATALOG.practices[i % 4]!, id: `GE-XX-${String(i).padStart(3, '0')}`, pattern: 'p'.repeat(400), rationale: 'r'.repeat(300), agent_snippet: 's'.repeat(300) }))
  const fit_rules = practices.map((p) => ({ card: p.id, when: { all: ['has_tests'], any: [], none: ['has_ci'] }, why: 'w'.repeat(120) }))
  const signals = Array.from({ length: 13 }, (_, i) => ({ name: `signal_${i}`, type: 'boolean', description: 'd'.repeat(120) }))
  const model = paneModelOf({ ...FIXTURE_CATALOG, practices, fit_rules, signals })
  expect(model.catalog?.practices.length).toBe(24)
  expect(JSON.stringify(model).length).toBeLessThan(60000)
})

// The model the plugin hands the Client, with the module state at its fullest.
function paneModelOf(catalog: typeof FIXTURE_CATALOG): PaneModel {
  return {
    catalog: slimCatalog(catalog), error: null, screen: 'practices', selected: null, query: '', category: 'All', tag: 'All', sort: 'fit',
    showSignals: false, collapsed: { fits: false, all: false }, signals: null, adoption: null,
    acks: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`${Date.now().toString(36)}-${'x'.repeat(30)}${i}`, { received: Number.MAX_SAFE_INTEGER, done: Number.MAX_SAFE_INTEGER }])),
  }
}
