import { test, expect } from 'claude-code/testing'
import { cliManifest, fakeRepo } from './test-support'

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

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: practices screen shows fits and adapts the selected card`, async ($, on) => {
    fakeRepo(on, REPO, DIRS)
    placePanes(on)
    const submitted: string[] = []
    captureSkills(on, submitted)
    await $.command.run(typed('grounded'))
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /Fits this repo/ })).toBeDefined()
    expect(await ui.find({ text: /4 gaps/ })).toBeDefined()
    expect((await ui.find({ key: 'fit-card-GE-AS-004' }))?.text).toContain('Why here:')
    expect((await ui.find({ key: 'card-GE-AS-004' }))?.text).toContain('In short:')
    expect((await ui.find({ key: 'card-GE-AS-004' }))?.text).not.toContain('Why here')
    expect(await ui.findAll({ type: 'Button', text: /./ }).then((all) => all.filter((b) => b.key?.startsWith('fit-select-')).length)).toBe(3)
    expect(await ui.find({ key: 'fit-primary-GE-AS-004' })).toBeUndefined()
    await ui.press({ key: 'fit-select-GE-AS-004' })
    // One selection expands one card: the Fits copy, not its All-practices copy.
    expect(await ui.find({ key: 'fit-primary-GE-AS-004' })).toBeDefined()
    expect(await ui.find({ key: 'primary-GE-AS-004' })).toBeUndefined()
    await ui.press({ key: 'fit-primary-GE-AS-004' })
    expect(submitted).toEqual(['grounded-engineering:adapt GE-AS-004'])
    await ui.unmount()
  })

  test(`${surface}: a test folder with an unrecognized framework is not reported as no tests`, async ($, on) => {
    fakeRepo(on, { 'CLAUDE.md': '# r' }, { tests: ['check.sh'] })
    placePanes(on)
    await $.command.run(typed('grounded'))
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /tests \(framework unknown\)/ })).toBeDefined()
    expect(await ui.find({ text: /no tests detected/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`${surface}: skill repos screen explains a selected repo and links to GitHub`, async ($, on) => {
    fakeRepo(on, REPO, DIRS)
    placePanes(on)
    const submitted: string[] = []
    captureSkills(on, submitted)
    await $.command.run(typed('grounded-skills'))
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'primary-GE-SR-002' })).toBeUndefined()
    await ui.press({ key: 'select-GE-SR-002' })
    // Link takes no key; only the selected card draws its links.
    const star = await ui.find({ type: 'Link', text: 'Star on GitHub' })
    expect(star?.props.href).toBe('https://github.com/example/beta-ts')
    expect((await ui.findAll({ type: 'Link', text: /./ })).filter((l) => l.props.href === star?.props.href)).toHaveLength(1)
    await ui.press({ key: 'primary-GE-SR-002' })
    expect(submitted).toEqual(['grounded-engineering:explain GE-SR-002'])
    await ui.unmount()
  })

  test(`${surface}: search filters the practice list`, async ($, on) => {
    fakeRepo(on, REPO, DIRS)
    placePanes(on)
    await $.command.run(typed('grounded'))
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.input({ key: 'search', text: 'sandbox', kind: 'change' })
    expect(await ui.find({ key: 'select-GE-VF-001' })).toBeUndefined()
    expect(await ui.find({ key: 'select-GE-VF-004' })).toBeDefined()
    expect(await ui.find({ text: 'No matches.' })).toBeUndefined()
    await ui.input({ key: 'search', text: 'no practice says this', kind: 'change' })
    expect(await ui.find({ text: 'No matches.' })).toBeDefined()
    await ui.unmount()
  })

  test(`${surface}: the tab buttons switch screens, and search belongs to the screen it was typed on`, async ($, on) => {
    fakeRepo(on, REPO, DIRS)
    placePanes(on)
    await $.command.run(typed('grounded'))
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.input({ key: 'search', text: 'sandbox', kind: 'change' })
    expect(await ui.find({ text: 'Hand-picked skill repos' })).toBeUndefined()
    await ui.press({ key: 'tab-skills' })
    expect(await ui.find({ text: 'Hand-picked skill repos' })).toBeDefined()
    expect(await ui.find({ text: /Fits this repo/ })).toBeUndefined()
    expect((await ui.find({ key: 'search' }))?.props.value).toBe('')
    expect(await ui.find({ key: 'select-GE-SR-001' })).toBeDefined()
    await ui.input({ key: 'search', text: 'no repo says this', kind: 'change' })
    expect(await ui.find({ text: 'No matches.' })).toBeDefined()
    await ui.unmount()
  })

  test(`${surface}: a command opening the pane clears an earlier search`, async ($, on) => {
    fakeRepo(on, REPO, DIRS)
    placePanes(on)
    await $.command.run(typed('grounded'))
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.input({ key: 'search', text: 'sandbox', kind: 'change' })
    expect(await ui.find({ key: 'select-GE-VF-001' })).toBeUndefined()
    await $.command.run(typed('grounded'))
    expect((await ui.find({ key: 'search' }))?.props.value).toBe('')
    expect(await ui.find({ key: 'select-GE-VF-001' })).toBeDefined()
    await ui.unmount()
  })

  test(`${surface}: a card adopted through the CLI keeps its trust badge and offers no primary action`, async ($, on) => {
    fakeRepo(on, { ...REPO, '.grounded-engineering/manifest.yaml': cliManifest('ai-assisted', ['GE-AS-004']) }, DIRS)
    placePanes(on)
    await $.command.run(typed('grounded'))
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: 'Adopted: ai-assisted · 1 of 4' })).toBeDefined()
    expect(await ui.find({ key: 'fit-select-GE-AS-004' })).toBeUndefined()
    // Collapsed, the card already says it was adopted, beside its trust badge.
    const collapsed = await ui.find({ key: 'card-GE-AS-004' })
    expect(collapsed?.text).toContain('Adopted through the CLI')
    expect(collapsed?.text).toContain('Validated')
    expect((await ui.find({ key: 'card-GE-VF-001' }))?.text).not.toContain('Adopted through the CLI')
    await ui.press({ key: 'select-GE-AS-004' })
    const card = await ui.find({ key: 'card-GE-AS-004' })
    expect(card?.text).toContain('Validated')
    expect(card?.text).toContain('Already adopted through the CLI')
    expect(await ui.find({ key: 'primary-GE-AS-004' })).toBeUndefined()
    expect(await ui.find({ type: 'Link', text: 'Evidence' })).toBeDefined()
    await ui.unmount()
  })

  test(`${surface}: a pane restored without a command reads the repository itself`, async ($, on) => {
    fakeRepo(on, REPO, DIRS)
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /Reading this repository/ })).toBeUndefined()
    expect(await ui.find({ text: /Fits this repo/ })).toBeDefined()
    expect(await ui.find({ text: /4 gaps/ })).toBeDefined()
    await ui.unmount()
  })

  test(`${surface}: a skill that fails to start says so in a toast`, async ($, on) => {
    fakeRepo(on, REPO, DIRS)
    placePanes(on)
    const toasts: string[] = []
    on('command.run', { command: 'grounded-engineering:adapt' }, async () => { throw new Error('refused') })
    on('ui.toast', async (_$: unknown, e: { text: string }) => { toasts.push(e.text); return { value: undefined } })
    await $.command.run(typed('grounded'))
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'fit-select-GE-AS-004' })
    await ui.press({ key: 'fit-primary-GE-AS-004' })
    expect(toasts).toEqual(['Could not start /grounded-engineering:adapt GE-AS-004'])
    await ui.unmount()
  })

  test(`${surface}: a missing catalog shows the reinstall message instead of a partial pane`, async ($, on) => {
    on('fs.read', async () => ({ deny: 'ENOENT' }))
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ key: 'catalog-error' }))?.text).toMatch(/Reinstall the plugin/)
    await ui.unmount()
  })
}
