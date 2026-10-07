import { test, expect } from 'claude-code/testing'
import { loadCatalog } from './catalog'
import { readSignals, readAdoption } from './signals'
import { rankPractices, sortSkillRepos, matchesQuery } from './fit'
import { FIXTURE_CATALOG, fakeHost } from './test-support'

const longSkill = Array.from({ length: 501 }, () => 'line').join('\n')

test('signals read a TypeScript repo with tests, no CI, and an unrestricted subagent', async () => {
  const host = fakeHost({
    'CLAUDE.md': '# rules', 'package.json': JSON.stringify({ devDependencies: { vitest: '1', typescript: '5' } }),
    'tsconfig.json': '{}', '.claude/settings.json': JSON.stringify({ hooks: { Stop: [] } }),
    '.claude/agents/reviewer.md': '---\nname: reviewer\n---\nReview.', '.claude/skills/big/SKILL.md': longSkill,
  }, { '.claude/agents': ['reviewer.md'], '.claude/skills': ['big/'], '.github/workflows': [] })
  const s = await readSignals(host)
  expect(s).toEqual({
    has_claude_md: true, has_agents_md: false, has_skills: true, has_large_skill_md: true, has_subagents: true,
    subagents_without_tool_limits: true, hooks_configured: true, sandbox_enabled: false, has_tests: true, has_ci: false,
    grounded_adopted: false, languages: ['typescript'], test_framework: 'vitest',
  })
})

test('an empty directory yields all-false signals', async () => {
  const host = fakeHost({})
  const s = await readSignals(host)
  expect(s.languages).toEqual([])
  expect(s.test_framework).toBe(null)
  expect(Object.entries(s).filter(([, v]) => v === true)).toEqual([])
})

test('adoption reads the profile and card ids from the CLI manifest', async () => {
  const host = fakeHost({ '.grounded-engineering/manifest.yaml': 'profile: ai-assisted\ncards:\n  - GE-VF-001\n  - GE-AS-004\n' })
  expect(await readAdoption(host)).toEqual({ profile: 'ai-assisted', cards: ['GE-AS-004', 'GE-VF-001'] })
})

const base = { has_claude_md: true, has_agents_md: false, has_skills: false, has_large_skill_md: false, has_subagents: true, subagents_without_tool_limits: true, hooks_configured: false, sandbox_enabled: false, has_tests: true, has_ci: false, grounded_adopted: false, languages: ['typescript'], test_framework: 'vitest' }

test('fits rank validated first, then by id, at most three', async () => {
  const fits = rankPractices(FIXTURE_CATALOG, base, null).map((f) => f.practice.id)
  expect(fits).toEqual(['GE-AS-004', 'GE-VF-004', 'GE-VF-001'])
})

test('adopted cards and non-firing rules are excluded', async () => {
  const fits = rankPractices(FIXTURE_CATALOG, { ...base, has_ci: true, sandbox_enabled: true }, { profile: 'ai-assisted', cards: ['GE-AS-004'] })
  expect(fits).toEqual([])
})

test('skill repos sort by fit, then name', async () => {
  expect(sortSkillRepos(FIXTURE_CATALOG.skill_repos, base, 'fit').map((r) => r.name)).toEqual(['beta-ts', 'alpha-skills'])
  expect(sortSkillRepos(FIXTURE_CATALOG.skill_repos, base, 'name').map((r) => r.name)).toEqual(['alpha-skills', 'beta-ts'])
})

test('search matches any field, case-insensitively, and an empty query matches all', async () => {
  expect(matchesQuery(['Bound delegated work'], 'DELEG')).toBe(true)
  expect(matchesQuery(['Bound delegated work'], 'sandbox')).toBe(false)
  expect(matchesQuery(['x'], '  ')).toBe(true)
})

test('the catalog loads from the plugin root and rejects a missing or unexpected file', async () => {
  const good = fakeHost({ '/plugin/catalog.json': JSON.stringify(FIXTURE_CATALOG) })
  expect((await loadCatalog(good)).practices.length).toBe(3)
  await expect(loadCatalog(fakeHost({}))).rejects.toThrow('catalog missing or invalid')
  await expect(loadCatalog(fakeHost({ '/plugin/catalog.json': '{"catalog_version":2,"practices":[]}' }))).rejects.toThrow('catalog missing or invalid')
})
