import { test, expect } from 'claude-code/testing'
import { cliManifest, fakeRepo, FIXTURE_CATALOG } from './test-support'

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
const captureSkills = (on: any, into: string[]) => {
  for (const command of ['grounded-engineering:adapt', 'grounded-engineering:explain']) {
    on('command.run', { command }, async (_$: unknown, e: { command: string; args: string }) => { into.push(`${e.command} ${e.args}`); return { text: '' } })
  }
}

const open = async (ui: any, key: string) => ui.find({ key })
const keysOf = async (ui: any, prefix: string): Promise<string[]> =>
  (await ui.findAll({ type: 'Button', text: /./ })).map((b: any) => b.key as string).filter((k: string) => k?.startsWith(prefix))

// The terminal draws the shared screens directly. Task-level desktop coverage lives with the Client.
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
