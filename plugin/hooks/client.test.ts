import { test, expect } from 'claude-code/testing'
import { shorten, room } from './tiles'
import { slimCatalog, type PaneModel } from './model'
import { HANDLER_NAMES } from './screens'
import { enqueue, nextPost, unseen, RESEND } from './client/outbox'
import { applyLocal, LOCAL_NAMES, type Msg } from './client/apply'
import { FIXTURE_CATALOG } from './test-support'

test('shorten keeps text that fits and cuts with an ellipsis when it does not', async () => {
  expect(shorten('Bound delegated work', 40)).toBe('Bound delegated work')
  expect(shorten('Gate network egress from agent-run work', 20)).toBe('Gate network egress…')
  expect(shorten('anything at all here', 0)).toBe('anything at all here')
})

test('room scales the width left after the suffix and never cuts below 11', async () => {
  expect(room(60, 12, 1)).toBe(39)
  expect(room(60, 12, 1.25)).toBe(48)
  expect(room(0, 12, 1)).toBe(0)
})

test('the slim catalog drops card bodies and sources and stays small', async () => {
  const slim = slimCatalog(FIXTURE_CATALOG)
  expect('sources' in slim).toBe(false)
  expect(slim.practices.every((p) => !('body' in p))).toBe(true)
  expect(slim.practices.length).toBe(FIXTURE_CATALOG.practices.length)
})

const act = (id: string, name: string, ...args: unknown[]): Msg => ({ kind: 'act', id, name, args })

test('the outbox keeps presses in order and a newer search replaces an unsent older one', async () => {
  let box: Msg[] = []
  box = enqueue(box, act('1', 'search', 'a'))
  box = enqueue(box, act('2', 'select', 'fit-X'))
  box = enqueue(box, act('3', 'search', 'ab'))
  expect(box.map((m) => m.id)).toEqual(['2', '3'])
})

test('every post carries all unreceived presses, resends after a while, and syncs when empty', async () => {
  const a = act('1', 'adapt', 'GE-AS-004')
  const b = act('2', 'select', 'fit-GE-AS-004')
  let r = nextPost([a], { syncDue: true, sentKey: '', sinceSend: 0 })
  expect(r.post).toEqual({ kind: 'acts', acts: [a] })
  r = nextPost([a, b], r.s)
  expect((r.post as { acts: Msg[] }).acts.map((m) => m.id)).toEqual(['1', '2'])
  r = nextPost([a, b], r.s)
  expect(r.post).toBe(null)
  let s = r.s
  for (let i = 1; i < RESEND; i++) s = nextPost([a, b], s).s
  expect(nextPost([a, b], s).post?.kind).toBe('acts')
  r = nextPost([], { syncDue: true, sentKey: '1,2', sinceSend: 0 })
  expect(r.post).toEqual({ kind: 'sync' })
  expect(nextPost([], r.s).post).toBe(null)
})

test('unseen drops the presses the plugin has received', async () => {
  const a = act('1', 'adapt', 'x')
  const b = act('2', 'tab', 'skills')
  expect(unseen([a, b], ['1'])).toEqual([b])
  expect(unseen([a, b], undefined)).toEqual([a, b])
})

test('applyLocal applies each press the Client shows at once, and select toggles', async () => {
  const m = paneModelOf(FIXTURE_CATALOG)
  expect(applyLocal({ ...m, selected: 'fit-A', query: 'q' }, act('1', 'tab', 'skills'))).toMatchObject({ screen: 'skills', selected: null, query: '' })
  expect(applyLocal(m, act('1', 'select', 'fit-A')).selected).toBe('fit-A')
  expect(applyLocal({ ...m, selected: 'fit-A' }, act('1', 'select', 'fit-A')).selected).toBe(null)
  expect(applyLocal(m, act('1', 'search', 'sandbox')).query).toBe('sandbox')
  expect(applyLocal(m, act('1', 'category', 'Verification')).category).toBe('Verification')
  expect(applyLocal(m, act('1', 'tag', 'testing')).tag).toBe('testing')
  expect(applyLocal(m, act('1', 'sort', 'name')).sort).toBe('name')
  expect(applyLocal(m, act('1', 'toggleSignals')).showSignals).toBe(true)
  expect(applyLocal(m, act('1', 'toggleLane', 'fits')).collapsed).toEqual({ fits: true, all: false })
  expect(applyLocal(m, act('1', 'adapt', 'GE-AS-004'))).toBe(m)
  expect([...LOCAL_NAMES].every((n) => (HANDLER_NAMES as readonly string[]).includes(n))).toBe(true)
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
    acked: Array.from({ length: 50 }, (_, i) => `${Date.now()}-${i}`), seen: Array.from({ length: 100 }, (_, i) => `${Date.now()}-${i}`),
  }
}
