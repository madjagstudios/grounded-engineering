import { test, expect } from 'claude-code/testing'
import { cliManifest, fakeRepo, FIXTURE_CATALOG } from './test-support'
import { cardUrl } from './catalog'
import { PALETTE } from './theme'

const REPO = { 'CLAUDE.md': '# r', 'package.json': JSON.stringify({ devDependencies: { vitest: '1' } }), '.claude/agents/a.md': '---\nname: a\n---\n' }
const DIRS = { '.claude/agents': ['a.md'] }
const PANE = {
  plugin: 'grounded-engineering', component: 'Pane' as const, requestId: 'grounded',
  props: { title: 'Grounded', isFocused: false, bodyColumns: 72, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const,
}
// The person typing the command at a fullscreen terminal, as the engine's own call site passes it.
const typed = (command: string) => ({ command, args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 160 } })
// The engine places panes; beneath the plugin a test answers for it.
const placePanes = (on: any) => on('ui.open', async () => ({ value: { isPlaced: true } }))
const openArgs = (on: any, into: any[]) => on('ui.open', async (_$: unknown, e: any) => { into.push(e); return { value: { isPlaced: true } } })
const captureSkills = (on: any, into: string[]) => {
  for (const command of ['grounded-engineering:adapt', 'grounded-engineering:explain']) {
    on('command.run', { command }, async (_$: unknown, e: { command: string; args: string }) => { into.push(`${e.command} ${e.args}`); return { text: '' } })
  }
}

const open = async (ui: any, key: string) => ui.find({ key })
const keysOf = async (ui: any, prefix: string): Promise<string[]> =>
  (await ui.findAll({ type: 'Button', text: /./ })).map((b: any) => b.key as string).filter((k: string) => k?.startsWith(prefix))

// The terminal draws the shared screens directly; the desktop tests below look inside the Client.
const mountPane = async ($: any, on: any, files: Record<string, string> = REPO, props: Record<string, unknown> = {}) => {
  fakeRepo(on, files, DIRS)
  placePanes(on)
  await $.command.run(typed('grounded'))
  return $.ui.mount({ ...PANE, props: { ...PANE.props, ...props }, surface: 'terminal' })
}

test('terminal: the Fits lane lists the top fits and counts the gaps', async ($, on) => {
  const ui = await mountPane($, on)
  expect(await ui.find({ text: /Fits this repo/ })).toBeDefined()
  expect(await ui.find({ text: /4 gaps/ })).toBeDefined()
  expect(await keysOf(ui, 'open-fit-')).toEqual(['open-fit-GE-AS-004', 'open-fit-GE-VF-004', 'open-fit-GE-TS-001'])
  expect((await ui.find({ key: 'tile-fit-GE-AS-004' }))?.text).toContain('Why here:')
  await ui.unmount()
})

test('terminal: opening a fit shows its primary action, which adapts the card', async ($, on) => {
  const submitted: string[] = []
  captureSkills(on, submitted)
  const ui = await mountPane($, on)
  expect(await open(ui, 'primary-fit-GE-AS-004')).toBeUndefined()
  await ui.press({ key: 'open-fit-GE-AS-004' })
  expect(await open(ui, 'primary-fit-GE-AS-004')).toBeDefined()
  await ui.press({ key: 'primary-fit-GE-AS-004' })
  expect(submitted).toEqual(['grounded-engineering:adapt GE-AS-004'])
  await ui.unmount()
})

test('terminal: the All list is compact rows and one selection expands one tile', async ($, on) => {
  const ui = await mountPane($, on)
  expect(await keysOf(ui, 'open-all-')).toEqual(['open-all-GE-AS-004', 'open-all-GE-VF-001', 'open-all-GE-VF-004', 'open-all-GE-TS-001'])
  expect(await keysOf(ui, 'primary-')).toEqual([])
  await ui.press({ key: 'open-all-GE-VF-001' })
  expect((await ui.find({ key: 'tile-all-GE-VF-001' }))?.text).toContain('In short:')
  expect(await keysOf(ui, 'primary-')).toEqual(['primary-all-GE-VF-001'])
  expect(await open(ui, 'tile-all-GE-VF-004')).toBeUndefined()
  expect(await open(ui, 'row-GE-VF-004')).toBeDefined()
  await ui.unmount()
})

test('terminal: category and search filter the All list', async ($, on) => {
  const ui = await mountPane($, on)
  await ui.press({ key: 'opt-cat-Verification' })
  expect(await keysOf(ui, 'open-all-')).toEqual(['open-all-GE-VF-001', 'open-all-GE-VF-004', 'open-all-GE-TS-001'])
  await ui.input({ key: 'search', text: 'sandbox', kind: 'change' })
  expect(await keysOf(ui, 'open-all-')).toEqual(['open-all-GE-VF-004'])
  expect(await ui.find({ text: 'No matches.' })).toBeUndefined()
  await ui.input({ key: 'search', text: 'no practice says this', kind: 'change' })
  expect(await ui.find({ text: 'No matches.' })).toBeDefined()
  await ui.unmount()
})

test('terminal: the lane header collapses the Fits lane', async ($, on) => {
  const ui = await mountPane($, on)
  expect((await keysOf(ui, 'open-fit-')).length).toBe(3)
  await ui.press({ key: 'lane-fits' })
  expect(await keysOf(ui, 'open-fit-')).toEqual([])
  expect((await keysOf(ui, 'open-all-')).length).toBe(4)
  await ui.press({ key: 'lane-all' })
  expect(await keysOf(ui, 'open-all-')).toEqual([])
  await ui.unmount()
})

test('terminal: a card adopted through the CLI offers no primary action', async ($, on) => {
  const ui = await mountPane($, on, { ...REPO, '.grounded-engineering/manifest.yaml': cliManifest('ai-assisted', ['GE-AS-004']) })
  expect(await ui.find({ text: /Adopted: ai-assisted · 1/ })).toBeDefined()
  expect(await open(ui, 'open-fit-GE-AS-004')).toBeUndefined()
  await ui.press({ key: 'open-all-GE-AS-004' })
  const card = await ui.find({ key: 'tile-all-GE-AS-004' })
  expect(card?.text).toContain('Adopted through the CLI')
  expect(await keysOf(ui, 'primary-')).toEqual([])
  expect(await ui.find({ type: 'Link', text: /Evidence/ })).toBeDefined()
  await ui.unmount()
})

test('terminal: the skill repos tab says so when none are listed', async ($, on) => {
  const ui = await mountPane($, on, { ...REPO, 'catalog.json': JSON.stringify({ ...FIXTURE_CATALOG, skill_repos: [] }) })
  await ui.press({ key: 'tab-skills' })
  expect(await ui.find({ text: 'No skill repos are listed yet.' })).toBeDefined()
  await ui.unmount()
})

test('terminal: a skill repo opens, explains, and links to GitHub', async ($, on) => {
  const submitted: string[] = []
  captureSkills(on, submitted)
  const ui = await mountPane($, on)
  await ui.press({ key: 'tab-skills' })
  // Sorted by fit: this repo uses TypeScript and tests, which beta-ts is tagged for.
  expect(await keysOf(ui, 'open-repo-')).toEqual(['open-repo-GE-SR-002', 'open-repo-GE-SR-001'])
  expect(await open(ui, 'primary-repo-GE-SR-002')).toBeUndefined()
  await ui.press({ key: 'open-repo-GE-SR-002' })
  expect((await ui.find({ type: 'Link', text: /Star on GitHub/ }))?.props.href).toBe('https://github.com/example/beta-ts')
  await ui.press({ key: 'primary-repo-GE-SR-002' })
  expect(submitted).toEqual(['grounded-engineering:explain GE-SR-002'])
  await ui.unmount()
})

test('terminal: the tab buttons switch screens, and search belongs to the screen it was typed on', async ($, on) => {
  const ui = await mountPane($, on)
  await ui.input({ key: 'search', text: 'sandbox', kind: 'change' })
  await ui.press({ key: 'tab-skills' })
  expect(await ui.find({ text: /Fits this repo/ })).toBeUndefined()
  expect((await ui.find({ key: 'search' }))?.props.value).toBe('')
  await ui.input({ key: 'search', text: 'no repo says this', kind: 'change' })
  expect(await ui.find({ text: 'No matches.' })).toBeDefined()
  await ui.press({ key: 'tab-practices' })
  expect(await ui.find({ text: /Fits this repo/ })).toBeDefined()
  await ui.unmount()
})

test('terminal: a command opening the pane clears an earlier search and reopens the lanes', async ($, on) => {
  const ui = await mountPane($, on)
  await ui.input({ key: 'search', text: 'sandbox', kind: 'change' })
  await ui.press({ key: 'lane-fits' })
  await $.command.run(typed('grounded'))
  expect((await ui.find({ key: 'search' }))?.props.value).toBe('')
  expect((await keysOf(ui, 'open-fit-')).length).toBe(3)
  await ui.unmount()
})

test('terminal: a narrow pane cuts a long title row with an ellipsis', async ($, on) => {
  const ui = await mountPane($, on, REPO, { bodyColumns: 40 })
  const row = await ui.find({ key: 'open-all-GE-VF-004' })
  expect(row?.text).toMatch(/…$/)
  await ui.unmount()
})

test('terminal: a pane restored without a command reads the repository itself', async ($, on) => {
  fakeRepo(on, REPO, DIRS)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /Reading this repository/ })).toBeUndefined()
  expect(await ui.find({ text: /Fits this repo/ })).toBeDefined()
  expect(await ui.find({ text: /4 gaps/ })).toBeDefined()
  await ui.unmount()
})

test('the command opens the pane asking for a 100-column dock', async ($, on) => {
  const opened: any[] = []
  fakeRepo(on, REPO, DIRS)
  openArgs(on, opened)
  await $.command.run(typed('grounded'))
  expect(opened.length).toBe(1)
  expect(opened[0]).toMatchObject({ id: 'grounded', title: 'Grounded', columns: 100 })
})

test('terminal: a missing catalog shows the reinstall message instead of a partial pane', async ($, on) => {
  on('fs.read', async () => ({ deny: 'ENOENT' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'catalog-error' }))?.text).toMatch(/Reinstall the plugin/)
  await ui.unmount()
})

test('terminal: a test folder with an unrecognized framework is not reported as no tests', async ($, on) => {
  fakeRepo(on, { 'CLAUDE.md': '# r' }, { tests: ['check.sh'] })
  placePanes(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /tests \(framework unknown\)/ })).toBeDefined()
  expect(await ui.find({ text: /^no tests$/ })).toBeUndefined()
  await ui.unmount()
})

test('terminal: a skill that fails to start says so in a toast', async ($, on) => {
  const toasts: string[] = []
  on('command.run', { command: 'grounded-engineering:adapt' }, async () => { throw new Error('refused') })
  on('ui.toast', async (_$: unknown, e: { text: string }) => { toasts.push(e.text); return { value: undefined } })
  const ui = await mountPane($, on)
  await ui.press({ key: 'open-fit-GE-AS-004' })
  await ui.press({ key: 'primary-fit-GE-AS-004' })
  expect(toasts).toEqual(['Could not start /grounded-engineering:adapt GE-AS-004'])
  await ui.unmount()
})

// Desktop draws the pane in a Client: look inside it, and let its poster and sync run.
// Each helper looks only inside the Client, so a Client that failed to draw fails the test.
const APP = 'grounded-app'
const look = (pane: any, q: any) => pane.find({ ...q, in: APP })
const lookAll = (pane: any, q: any) => pane.findAll({ ...q, in: APP })
const drawnAll = (pane: any) => pane.drawn({ in: APP })
const settle = async (pane: any) => { await pane.advance(100); await pane.advance(100) }
const clientKeys = async (pane: any, prefix: string): Promise<string[]> =>
  (await lookAll(pane, { type: 'Button', text: /./ })).map((b: any) => b.key as string).filter((k: string) => k?.startsWith(prefix))
const walk = (node: any, visit: (n: any, parent: any) => void, parent: any = null) => {
  if (!node || typeof node !== 'object') return
  visit(node, parent)
  for (const c of [].concat(node.children ?? [])) walk(c, visit, node)
}
// The model the plugin last handed the Client, as the pane's own tree carries it.
const handed = async (pane: any) => ((await pane.drawn()) as any).props.props

const mountDesktop = async ($: any, on: any) => {
  fakeRepo(on, REPO, DIRS)
  placePanes(on)
  await $.command.run(typed('grounded'))
  return $.ui.mount({ ...PANE, surface: 'desktop' })
}

test('desktop: the pane is one Client that draws the shared screens', async ($, on) => {
  const ui = await mountDesktop($, on)
  const outer = (await ui.drawn()) as any
  expect(outer.type).toBe('Client')
  expect(outer.props.key).toBe(APP)
  expect(await look(ui, { text: /Fits this repo/ })).toBeDefined()
  expect(await clientKeys(ui, 'open-fit-')).toEqual(['open-fit-GE-AS-004', 'open-fit-GE-VF-004', 'open-fit-GE-TS-001'])
  await ui.unmount()
})

test('desktop: opening a fit shows the tile at once, before the plugin hears the press, and a sync confirms it', async ($, on) => {
  const submitted: string[] = []
  captureSkills(on, submitted)
  const ui = await mountDesktop($, on)
  await ui.press({ key: 'open-fit-GE-AS-004', in: APP })
  // Nothing has been posted yet: the plugin's model still has no selection.
  expect((await handed(ui)).selected).toBe(null)
  expect(await look(ui, { key: 'primary-fit-GE-AS-004' })).toBeDefined()
  await ui.advance(1100)
  await settle(ui)
  expect((await handed(ui)).selected).toBe('fit-GE-AS-004')
  expect(await look(ui, { key: 'primary-fit-GE-AS-004' })).toBeDefined()
  expect(submitted).toEqual([])
  await ui.unmount()
})

test('desktop: the primary action starts its skill once, however often the poster runs', async ($, on) => {
  const submitted: string[] = []
  captureSkills(on, submitted)
  const ui = await mountDesktop($, on)
  await ui.press({ key: 'open-fit-GE-AS-004', in: APP })
  await ui.press({ key: 'primary-fit-GE-AS-004', in: APP })
  expect(await look(ui, { text: /Starting…/ })).toBeDefined()
  expect(submitted).toEqual([])
  await settle(ui)
  expect(submitted).toEqual(['grounded-engineering:adapt GE-AS-004'])
  expect(await look(ui, { text: /Starting…/ })).toBeUndefined()
  // Past the resend interval and a sync: the press is not run again.
  for (let i = 0; i < 12; i++) await ui.advance(100)
  await ui.advance(1100)
  await settle(ui)
  expect(submitted).toEqual(['grounded-engineering:adapt GE-AS-004'])
  await ui.unmount()
})

test('desktop: search filters the All list at once', async ($, on) => {
  const ui = await mountDesktop($, on)
  await ui.input({ key: 'search', text: 'sandbox', kind: 'change', in: APP })
  expect(await clientKeys(ui, 'open-all-')).toEqual(['open-all-GE-VF-004'])
  await settle(ui)
  expect((await handed(ui)).query).toBe('sandbox')
  expect(await clientKeys(ui, 'open-all-')).toEqual(['open-all-GE-VF-004'])
  await ui.unmount()
})

test('desktop: a narrow Client cuts a long row title with an ellipsis', async ($, on) => {
  const ui = await mountDesktop($, on)
  await ui.resize({ columns: 50, rows: 40, in: APP })
  await settle(ui)
  const row = (await look(ui, { key: 'open-all-GE-VF-004' })) as any
  expect(row.props.label).toMatch(/… $/)
  expect(row.props.label.length).toBeLessThan(48)
  await ui.unmount()
})

// Watches the link command from above the plugin, and says what it saw in a toast the test hears.
const LINK_WATCH = {
  name: 'link-watch', tier: 'prepend' as const,
  register: (on: any) => {
    on('command.run', { command: 'grounded-link' }, async ($: any, e: any, next: any) => {
      const r = await next(e)
      await $.ui.toast(`grounded-link ${e.args} => ${r?.text ?? ''}`)
      return r
    })
  },
}
const toastsInto = (on: any, into: string[]) => on('ui.toast', async (_$: unknown, e: { text: string }) => { into.push(e.text); return { value: undefined } })

test('desktop: an open fit draws no Link and no Markdown; its Evidence button prints the card link in the transcript', { plugins: [LINK_WATCH] }, async ($, on) => {
  const seen: string[] = []
  toastsInto(on, seen)
  const ui = await mountDesktop($, on)
  await ui.press({ key: 'open-fit-GE-AS-004', in: APP })
  await settle(ui)
  const types = new Set<string>()
  walk(await drawnAll(ui), (n) => types.add(n.type))
  expect(types.has('Link')).toBe(false)
  expect(types.has('Markdown')).toBe(false)
  const evidence = (await look(ui, { type: 'Button', text: /Evidence/ })) as any
  expect(evidence.props.label).toBe(' Evidence ↗ ')
  expect(evidence.props.key).toMatch(/^link-[0-9a-z]+$/)
  await ui.press({ key: evidence.props.key, in: APP })
  await settle(ui)
  const url = cardUrl(FIXTURE_CATALOG, FIXTURE_CATALOG.practices[0]!)
  expect(seen).toEqual([`grounded-link ${url} => Evidence for GE-AS-004: ${url}`])
  await ui.unmount()
})

test('desktop: a link the pane does not draw, posted to the plugin, runs no command', { plugins: [LINK_WATCH] }, async ($, on) => {
  const seen: string[] = []
  toastsInto(on, seen)
  const ui = await mountDesktop($, on)
  // The select after it shows the batch was run.
  await ui.post({ kind: 'acts', acts: [
    { kind: 'act', id: 'forged-1', name: 'link', args: ['https://example.net/forged'] },
    { kind: 'act', id: 'forged-2', name: 'select', args: ['fit-GE-AS-004'] },
  ] }, { in: APP })
  await settle(ui)
  expect(await look(ui, { key: 'primary-fit-GE-AS-004' })).toBeDefined()
  expect(seen).toEqual([])
  await ui.unmount()
})

test('the link command prints only links the pane draws, and never echoes another', async ($, on) => {
  fakeRepo(on, REPO, DIRS)
  const url = cardUrl(FIXTURE_CATALOG, FIXTURE_CATALOG.practices[0]!)
  expect((await $.command.run({ ...typed('grounded-link'), args: url })).text).toBe(`Evidence for GE-AS-004: ${url}`)
  expect((await $.command.run({ ...typed('grounded-link'), args: 'https://github.com/example/beta-ts' })).text).toBe('beta-ts on GitHub: https://github.com/example/beta-ts')
  const forged = await $.command.run({ ...typed('grounded-link'), args: 'https://example.net/forged' })
  expect(forged.text ?? '').not.toContain('example.net')
})

test('desktop: every opener is an outlined title sized to its label, with no ›, a selected fit title too', async ($, on) => {
  const ui = await mountDesktop($, on)
  await ui.resize({ columns: 100, rows: 40, in: APP })
  await settle(ui)
  const label = async (key: string) => ((await look(ui, { key })) as any).props.label as string
  expect(await label('open-fit-GE-AS-004')).toBe(' Bound delegated work ')
  await ui.press({ key: 'open-fit-GE-AS-004', in: APP })
  expect(await label('open-fit-GE-AS-004')).toBe(' Bound delegated work ')
  expect(await label('open-all-GE-VF-001')).toBe(' Use the real verification gate ')
  const buttons: { node: any; parent: any }[] = []
  walk(await drawnAll(ui), (n, parent) => { if (n.type === 'Button') buttons.push({ node: n, parent }) })
  const openers = buttons.filter((b) => String(b.node.props.key).startsWith('open-'))
  expect(openers.length).toBeGreaterThan(5)
  for (const { node, parent } of openers) {
    expect(node.props.label).not.toMatch(/›/)
    expect(parent.props.borderStyle).toBe('round')
    expect(parent.props.borderColor).toBe(PALETTE.neutral.edge)
    expect(parent.props.minWidth).toBe(0)
    expect(parent.props.flexGrow).toBeUndefined()
  }
  await ui.unmount()
})

test('desktop: at 40 columns every opener title fits on one line beside its outline and symbol', async ($, on) => {
  const ui = await mountDesktop($, on)
  await ui.resize({ columns: 40, rows: 40, in: APP })
  await settle(ui)
  await ui.press({ key: 'open-fit-GE-VF-004', in: APP })
  const check = async () => {
    const openers = (await lookAll(ui, { type: 'Button', text: /./ })).filter((b: any) => String(b.key).startsWith('open-'))
    expect(openers.length).toBeGreaterThan(1)
    for (const b of openers) expect((b as any).props.label.length).toBeLessThanOrEqual(30)
  }
  await check()
  await ui.press({ key: 'tab-skills', in: APP })
  await ui.press({ key: 'open-repo-GE-SR-002', in: APP })
  await check()
  await ui.unmount()
})

test('desktop: a narrow Client drops the category beside each row and a wide one keeps it', async ($, on) => {
  const ui = await mountDesktop($, on)
  await ui.resize({ columns: 50, rows: 40, in: APP })
  await settle(ui)
  expect(await look(ui, { type: 'Text', text: 'Agent & Skill Design' })).toBeUndefined()
  expect(await look(ui, { key: 'opt-cat-Agent & Skill Design' })).toBeDefined()
  await ui.resize({ columns: 100, rows: 40, in: APP })
  await settle(ui)
  expect(await look(ui, { type: 'Text', text: 'Agent & Skill Design' })).toBeDefined()
  await ui.unmount()
})

test('terminal: each row keeps its category beside it', async ($, on) => {
  const ui = await mountPane($, on, REPO, { bodyColumns: 40 })
  expect(await ui.find({ type: 'Text', text: 'Agent & Skill Design' })).toBeDefined()
  await ui.unmount()
})

// Wrapped options sit on consecutive lines: the row has no vertical gap.
const optionRowOf = (tree: any, key: string): any => {
  const find = (node: any, trail: any[]): any => {
    if (!node || typeof node !== 'object') return undefined
    if (node.type === 'Button' && node.props.key === key) return [...trail].reverse().find((n) => n.props?.flexWrap)
    for (const c of [].concat(node.children ?? [])) { const r = find(c, [...trail, node]); if (r) return r }
    return undefined
  }
  return find(tree, [])
}
test('wrapped option rows have no blank line between them, on both surfaces', async ($, on) => {
  const term = await mountPane($, on)
  for (const row of [optionRowOf(await term.drawn(), 'opt-cat-All')]) {
    expect(row.props.flexWrap).toBe('wrap')
    expect(row.props.rowGap).toBe(0)
    expect(row.props.gap).toBeUndefined()
  }
  await term.press({ key: 'tab-skills' })
  expect(optionRowOf(await term.drawn(), 'opt-tag-All').props.rowGap).toBe(0)
  await term.press({ key: 'tab-practices' })
  await term.unmount()
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const row = optionRowOf(await desk.drawn({ in: APP }), 'opt-cat-All')
  expect(row.props.rowGap).toBe(0)
  expect(row.props.gap).toBeUndefined()
  await desk.unmount()
})

test('desktop: the Details button never shrinks, so it cannot wrap onto two lines', async ($, on) => {
  const ui = await mountDesktop($, on)
  let chain: any[] = []
  const find = (node: any, trail: any[]): boolean => {
    if (!node || typeof node !== 'object') return false
    const here = [...trail, node]
    if (node.type === 'Button' && node.props.key === 'details') { chain = here; return true }
    return [].concat(node.children ?? []).some((c) => find(c, here))
  }
  expect(find(await drawnAll(ui), [])).toBe(true)
  expect(chain.slice(-3).some((n) => n.type === 'Box' && n.props.flexShrink === 0)).toBe(true)
  await ui.unmount()
})

test('desktop: the header drops its title when the Client is narrow and keeps it when wide', async ($, on) => {
  const ui = await mountDesktop($, on)
  await ui.resize({ columns: 100, rows: 40, in: APP })
  await settle(ui)
  expect(await look(ui, { text: 'Grounded Engineering' })).toBeDefined()
  await ui.resize({ columns: 50, rows: 40, in: APP })
  await settle(ui)
  expect(await look(ui, { text: 'Grounded Engineering' })).toBeUndefined()
  expect(await look(ui, { key: 'tab-practices' })).toBeDefined()
  expect(await look(ui, { key: 'tab-skills' })).toBeDefined()
  await ui.unmount()
})

test('desktop: every Client button carries its label as a prop, and actions sit in an outlined box', async ($, on) => {
  const ui = await mountDesktop($, on)
  await ui.press({ key: 'open-fit-GE-AS-004', in: APP })
  await settle(ui)
  const buttons: { node: any; parent: any }[] = []
  walk(await drawnAll(ui), (n, parent) => { if (n.type === 'Button') buttons.push({ node: n, parent }) })
  expect(buttons.length).toBeGreaterThan(10)
  for (const { node } of buttons) {
    expect(typeof node.props.label).toBe('string')
    expect(node.props.hotkey).toBeUndefined()
    expect(node.props.dimColor).toBeUndefined()
  }
  const parentOf = (key: string) => buttons.find((b) => b.node.props.key === key)?.parent
  expect(parentOf('primary-fit-GE-AS-004')?.props.borderStyle).toBe('round')
  expect(parentOf('primary-fit-GE-AS-004')?.props.backgroundColor).toBeTruthy()
  expect(parentOf('tab-skills')?.props.borderStyle).toBe('round')
  expect(parentOf('tab-skills')?.props.backgroundColor).toBeUndefined()
  // Every opener is outlined too; options and lane arrows stay plain text controls.
  expect(parentOf('open-fit-GE-AS-004')?.props.borderStyle).toBe('round')
  expect(parentOf('opt-cat-All')?.props.borderStyle).toBeUndefined()
  expect(parentOf('lane-fits')?.props.borderStyle).toBeUndefined()
  await ui.unmount()
})

test('desktop: the skill repos tab switches at once and explains a repo once', async ($, on) => {
  const submitted: string[] = []
  captureSkills(on, submitted)
  const ui = await mountDesktop($, on)
  await ui.press({ key: 'tab-skills', in: APP })
  expect(await look(ui, { text: /Fits this repo/ })).toBeUndefined()
  expect(await clientKeys(ui, 'open-repo-')).toEqual(['open-repo-GE-SR-002', 'open-repo-GE-SR-001'])
  await ui.press({ key: 'open-repo-GE-SR-002', in: APP })
  await ui.press({ key: 'primary-repo-GE-SR-002', in: APP })
  await settle(ui)
  expect(submitted).toEqual(['grounded-engineering:explain GE-SR-002'])
  expect((await handed(ui)).screen).toBe('skills')
  await ui.unmount()
})
