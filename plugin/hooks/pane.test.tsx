import { test, expect } from 'claude-code/testing'
import { fakeRepo } from './test-support'

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
    expect(await ui.find({ key: 'fit-select-GE-AS-004' })).toBeDefined()
    await ui.press({ key: 'fit-select-GE-AS-004' })
    await ui.press({ key: 'fit-primary-GE-AS-004' })
    expect(submitted).toEqual(['grounded-engineering:adapt GE-AS-004'])
    await ui.unmount()
  })

  test(`${surface}: skill repos screen explains a selected repo and links to GitHub`, async ($, on) => {
    fakeRepo(on, REPO, DIRS)
    placePanes(on)
    const submitted: string[] = []
    captureSkills(on, submitted)
    await $.command.run(typed('grounded-skills'))
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'select-GE-SR-002' })
    // Link takes no key; only the selected card draws its links.
    const star = await ui.find({ type: 'Link', text: 'Star on GitHub' })
    expect(star?.props.href).toBe('https://github.com/example/beta-ts')
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
    await ui.unmount()
  })

  test(`${surface}: a missing catalog shows the reinstall message instead of a partial pane`, async ($, on) => {
    on('fs.read', async () => ({ deny: 'ENOENT' }))
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ key: 'catalog-error' }))?.text).toMatch(/Reinstall the plugin/)
    await ui.unmount()
  })
}
