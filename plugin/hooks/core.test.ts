import { test, expect } from 'claude-code/testing'
import { loadCatalog } from './catalog'
import { readSignals, readAdoption } from './signals'
import { rankPractices, sortSkillRepos, matchesQuery } from './fit'
import { FIXTURE_CATALOG, fakeHost } from './test-support'

const lines = (n: number) => Array.from({ length: n }, () => 'line').join('\n')
const longSkill = lines(501)
const signalsOf = (files: Record<string, string>, dirs: Record<string, string[]> = {}) => readSignals(fakeHost(files, dirs))
const pkg = (value: object) => ({ 'package.json': JSON.stringify(value) })

test('signals read a TypeScript repo with tests, no CI, and an unrestricted subagent', async () => {
  const s = await signalsOf({
    'CLAUDE.md': '# rules', ...pkg({ devDependencies: { vitest: '1', typescript: '5' } }),
    'tsconfig.json': '{}', '.claude/settings.json': JSON.stringify({ hooks: { Stop: [] } }),
    '.claude/agents/reviewer.md': '---\nname: reviewer\n---\nReview.', '.claude/skills/big/SKILL.md': longSkill,
  }, { '.claude/agents': ['reviewer.md'], '.claude/skills': ['big/'], '.github/workflows': [] })
  expect(s).toEqual({
    has_claude_md: true, has_agents_md: false, has_skills: true, has_large_skill_md: true, has_subagents: true,
    subagents_without_tool_limits: true, hooks_configured: true, sandbox_enabled: false, has_tests: true, has_ci: false,
    grounded_adopted: false, languages: ['typescript'], test_framework: 'vitest',
  })
})

test('an empty directory yields all-false signals', async () => {
  const s = await signalsOf({})
  expect(s.languages).toEqual([])
  expect(s.test_framework).toBe(null)
  expect(Object.entries(s).filter(([, v]) => v === true)).toEqual([])
})

const BOOLEAN_CASES: { name: string; signal: string; files: Record<string, string>; dirs?: Record<string, string[]>; expected: boolean }[] = [
  { name: 'AGENTS.md present', signal: 'has_agents_md', files: { 'AGENTS.md': '# a' }, expected: true },
  { name: 'AGENTS.md absent', signal: 'has_agents_md', files: { 'CLAUDE.md': '# c' }, expected: false },
  { name: 'CLAUDE.md under .claude', signal: 'has_claude_md', files: { '.claude/CLAUDE.md': '# c' }, expected: true },
  { name: 'CLAUDE.md absent', signal: 'has_claude_md', files: { 'AGENTS.md': '# a' }, expected: false },
  { name: 'sandbox enabled', signal: 'sandbox_enabled', files: { '.claude/settings.json': '{"sandbox":{"enabled":true}}' }, expected: true },
  { name: 'sandbox present but not enabled', signal: 'sandbox_enabled', files: { '.claude/settings.json': '{"sandbox":{"enabled":false}}' }, expected: false },
  { name: 'settings that are not JSON', signal: 'sandbox_enabled', files: { '.claude/settings.json': '{nope' }, expected: false },
  { name: 'a hook defined', signal: 'hooks_configured', files: { '.claude/settings.json': '{"hooks":{"Stop":[]}}' }, expected: true },
  { name: 'an empty hooks object', signal: 'hooks_configured', files: { '.claude/settings.json': '{"hooks":{}}' }, expected: false },
  { name: 'workflow .yml', signal: 'has_ci', files: {}, dirs: { '.github/workflows': ['ci.yml'] }, expected: true },
  { name: 'workflow .yaml', signal: 'has_ci', files: {}, dirs: { '.github/workflows': ['ci.yaml'] }, expected: true },
  { name: 'gitlab CI file', signal: 'has_ci', files: { '.gitlab-ci.yml': 'x' }, expected: true },
  { name: 'workflows folder with no workflow', signal: 'has_ci', files: {}, dirs: { '.github/workflows': ['README.md'] }, expected: false },
  { name: 'manifest present', signal: 'grounded_adopted', files: { '.grounded-engineering/manifest.yaml': 'pack_id: baseline' }, expected: true },
  { name: 'manifest absent', signal: 'grounded_adopted', files: { 'AGENTS.md': '#' }, expected: false },
  { name: 'a skill', signal: 'has_skills', files: { '.claude/skills/a/SKILL.md': 'x' }, dirs: { '.claude/skills': ['a/'] }, expected: true },
  { name: 'a skills folder with no SKILL.md', signal: 'has_skills', files: {}, dirs: { '.claude/skills': ['a/'] }, expected: false },
  { name: 'a 500-line skill', signal: 'has_large_skill_md', files: { '.claude/skills/a/SKILL.md': lines(500) }, dirs: { '.claude/skills': ['a/'] }, expected: false },
  { name: 'a 500-line skill with a final newline', signal: 'has_large_skill_md', files: { '.claude/skills/a/SKILL.md': `${lines(500)}\n` }, dirs: { '.claude/skills': ['a/'] }, expected: false },
  { name: 'a 501-line skill', signal: 'has_large_skill_md', files: { '.claude/skills/a/SKILL.md': lines(501) }, dirs: { '.claude/skills': ['a/'] }, expected: true },
  { name: 'a subagent', signal: 'has_subagents', files: { '.claude/agents/a.md': '---\nname: a\n---\n' }, dirs: { '.claude/agents': ['a.md'] }, expected: true },
  { name: 'a non-markdown file in agents', signal: 'has_subagents', files: {}, dirs: { '.claude/agents': ['notes.txt'] }, expected: false },
  { name: 'a subagent with no tools field', signal: 'subagents_without_tool_limits', files: { '.claude/agents/a.md': '---\nname: a\n---\n' }, dirs: { '.claude/agents': ['a.md'] }, expected: true },
  { name: 'a subagent that limits its tools', signal: 'subagents_without_tool_limits', files: { '.claude/agents/a.md': '---\nname: a\ntools: Read, Grep\n---\n' }, dirs: { '.claude/agents': ['a.md'] }, expected: false },
  { name: 'a test directory only', signal: 'has_tests', files: {}, dirs: { test: [] }, expected: true },
]

for (const c of BOOLEAN_CASES) {
  test(`signal ${c.signal} is ${c.expected}: ${c.name}`, async () => {
    expect((await signalsOf(c.files, c.dirs ?? {}))[c.signal as 'has_ci']).toBe(c.expected)
  })
}

test('a subagent that limits its tools still counts as a subagent', async () => {
  const s = await signalsOf({ '.claude/agents/a.md': '---\nname: a\ntools: Read\n---\n' }, { '.claude/agents': ['a.md'] })
  expect(s.has_subagents).toBe(true)
  expect(s.subagents_without_tool_limits).toBe(false)
})

const STACK_CASES: { name: string; files: Record<string, string>; languages: string[]; framework: string | null }[] = [
  { name: 'jest', files: pkg({ devDependencies: { jest: '1' } }), languages: ['javascript'], framework: 'jest' },
  { name: 'vitest', files: pkg({ devDependencies: { vitest: '1' } }), languages: ['javascript'], framework: 'vitest' },
  { name: 'node --test', files: pkg({ scripts: { test: 'node --test test/' } }), languages: ['javascript'], framework: 'node-test' },
  { name: 'JavaScript without TypeScript', files: pkg({ name: 'x' }), languages: ['javascript'], framework: null },
  { name: 'TypeScript from a dependency', files: pkg({ devDependencies: { typescript: '5' } }), languages: ['typescript'], framework: null },
  { name: 'TypeScript from tsconfig', files: { ...pkg({}), 'tsconfig.json': '{}' }, languages: ['typescript'], framework: null },
  { name: 'pytest from pytest.ini', files: { 'requirements.txt': 'pytest', 'pytest.ini': '' }, languages: ['python'], framework: 'pytest' },
  { name: 'pytest from conftest.py', files: { 'requirements.txt': 'x', 'conftest.py': '' }, languages: ['python'], framework: 'pytest' },
  { name: 'pytest from pyproject', files: { 'pyproject.toml': '[tool.pytest.ini_options]' }, languages: ['python'], framework: 'pytest' },
  { name: 'Python without a test framework', files: { 'pyproject.toml': '[project]' }, languages: ['python'], framework: null },
  { name: 'Go', files: { 'go.mod': 'module x' }, languages: ['go'], framework: 'go-test' },
  { name: 'Rust', files: { 'Cargo.toml': '[package]' }, languages: ['rust'], framework: 'cargo-test' },
  { name: 'several languages, in a fixed order', files: { ...pkg({}), 'go.mod': 'x', 'Cargo.toml': 'x', 'requirements.txt': 'x' }, languages: ['javascript', 'python', 'go', 'rust'], framework: 'go-test' },
]

for (const c of STACK_CASES) {
  test(`stack: ${c.name}`, async () => {
    const s = await signalsOf(c.files)
    expect(s.languages).toEqual(c.languages)
    expect(s.test_framework).toBe(c.framework)
    expect(s.has_tests).toBe(c.framework !== null)
  })
}

// The shape buildManifest writes, serialized as the CLI writes it.
const MANIFEST = `record_type: adoption_manifest
manifest_version: 1.0.0
schema_version: 1.0.0
grounded_engineering_release: 0.5.0
pack_id: ai-assisted
pack_version: 1.0.0
cards:
  - id: GE-VF-001
    public_disposition: recommended
    local_applicability: applies
    source_refs:
      - S1
  - id: GE-AS-004
    public_disposition: recommended
    local_applicability: adapted
    local_decision: Scoped to reviewer agents only.
    revisit_trigger: Revisit when GE-VF-004 is adopted or the agents change.
    source_refs:
      - S1
      - S2
targets:
  - path: AGENTS.md
    kind: agents-md
    precondition_sha256: absent
    managed_block_sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
validation:
  status: valid
`

test('adoption reads the pack and the card ids from the CLI manifest, not ids mentioned in free text', async () => {
  const adoption = await readAdoption(fakeHost({ '.grounded-engineering/manifest.yaml': MANIFEST }))
  expect(adoption).toEqual({ profile: 'ai-assisted', cards: ['GE-AS-004', 'GE-VF-001'] })
  expect(adoption?.cards).not.toContain('GE-VF-004')
})

test('adoption is null without a manifest, and tolerates one with no cards', async () => {
  expect(await readAdoption(fakeHost({}))).toBe(null)
  expect(await readAdoption(fakeHost({ '.grounded-engineering/manifest.yaml': 'pack_id: baseline\ncards: []\n' }))).toEqual({ profile: 'baseline', cards: [] })
})

test('the catalog loads from the plugin root', async () => {
  const good = fakeHost({ '/plugin/catalog.json': JSON.stringify(FIXTURE_CATALOG) })
  expect((await loadCatalog(good)).practices.length).toBe(FIXTURE_CATALOG.practices.length)
})

test('a missing, malformed, null or wrongly versioned catalog throws the plain error', async () => {
  const bad = ['{nope', 'null', '[]', '"text"', '{"catalog_version":2,"practices":[]}', '{"catalog_version":1}']
  await expect(loadCatalog(fakeHost({}))).rejects.toThrow('catalog missing or invalid')
  for (const text of bad) {
    await expect(loadCatalog(fakeHost({ '/plugin/catalog.json': text }))).rejects.toThrow('catalog missing or invalid')
  }
})

test('a catalog whose repository is not an https URL throws the plain error', async () => {
  for (const repository of [undefined, 42, '', 'http://github.com/x/y', 'javascript:alert(1)', 'https://user@github.com/x', 'github.com/x/y']) {
    const text = JSON.stringify({ ...FIXTURE_CATALOG, repository })
    await expect(loadCatalog(fakeHost({ '/plugin/catalog.json': text }))).rejects.toThrow('catalog missing or invalid')
  }
})

const base = { has_claude_md: true, has_agents_md: false, has_skills: false, has_large_skill_md: false, has_subagents: true, subagents_without_tool_limits: true, hooks_configured: false, sandbox_enabled: false, has_tests: true, has_ci: false, grounded_adopted: false, languages: ['typescript'], test_framework: 'vitest' }

test('fits rank validated first, then by id, and show at most three of four that fire', async () => {
  const fits = rankPractices(FIXTURE_CATALOG, base, null).map((f) => f.practice.id)
  expect(fits).toEqual(['GE-AS-004', 'GE-VF-004', 'GE-TS-001'])
})

test('the uncapped ranking counts every firing card, so the summary can say 4 where the list shows 3', async () => {
  expect(rankPractices(FIXTURE_CATALOG, base, null, Infinity).map((f) => f.practice.id)).toEqual(['GE-AS-004', 'GE-VF-004', 'GE-TS-001', 'GE-VF-001'])
  expect(rankPractices(FIXTURE_CATALOG, base, null)).toHaveLength(3)
  expect(rankPractices(FIXTURE_CATALOG, base, null, 2)).toHaveLength(2)
})

test('adopted cards and non-firing rules are excluded', async () => {
  const fits = rankPractices(FIXTURE_CATALOG, { ...base, has_ci: true, sandbox_enabled: true }, { profile: 'ai-assisted', cards: ['GE-AS-004'] })
  expect(fits).toEqual([])
})

const withRules = (fit_rules: typeof FIXTURE_CATALOG.fit_rules) => ({ ...FIXTURE_CATALOG, fit_rules })

test('a rule with a non-empty any needs one of them, on top of all and none', async () => {
  const catalog = withRules([{ card: 'GE-VF-001', when: { all: ['has_tests'], any: ['hooks_configured', 'has_skills'], none: ['has_ci'] }, why: 'any' }])
  expect(rankPractices(catalog, base, null)).toEqual([])
  expect(rankPractices(catalog, { ...base, has_skills: true }, null).map((f) => f.why)).toEqual(['any'])
  expect(rankPractices(catalog, { ...base, hooks_configured: true }, null).map((f) => f.why)).toEqual(['any'])
  expect(rankPractices(catalog, { ...base, hooks_configured: true, has_ci: true }, null)).toEqual([])
  expect(rankPractices(catalog, { ...base, hooks_configured: true, has_tests: false }, null)).toEqual([])
})

test('a card with two firing rules appears once, with the first rule\'s why', async () => {
  const when = { all: ['has_tests'], any: [], none: [] }
  const catalog = withRules([{ card: 'GE-VF-001', when, why: 'first' }, { card: 'GE-VF-001', when, why: 'second' }])
  expect(rankPractices(catalog, base, null).map((f) => [f.practice.id, f.why])).toEqual([['GE-VF-001', 'first']])
})

test('a later rule supplies the why when the earlier one does not fire', async () => {
  const catalog = withRules([
    { card: 'GE-VF-001', when: { all: ['has_ci'], any: [], none: [] }, why: 'first' },
    { card: 'GE-VF-001', when: { all: ['has_tests'], any: [], none: [] }, why: 'second' },
  ])
  expect(rankPractices(catalog, base, null).map((f) => f.why)).toEqual(['second'])
})

test('a rule naming a card that is not in the catalog is ignored', async () => {
  const catalog = withRules([{ card: 'GE-XX-999', when: { all: [], any: [], none: [] }, why: 'ghost' }])
  expect(rankPractices(catalog, base, null)).toEqual([])
})

test('skill repos sort by fit, then name', async () => {
  expect(sortSkillRepos(FIXTURE_CATALOG.skill_repos, base, 'fit').map((r) => r.name)).toEqual(['beta-ts', 'alpha-skills'])
  expect(sortSkillRepos(FIXTURE_CATALOG.skill_repos, base, 'name').map((r) => r.name)).toEqual(['alpha-skills', 'beta-ts'])
})

test('a tag named like an inherited property never scores', async () => {
  const [repo] = FIXTURE_CATALOG.skill_repos
  const odd = { ...repo!, id: 'GE-SR-009', name: 'zeta', tags: ['constructor', 'toString', '__proto__'] }
  expect(sortSkillRepos([odd, ...FIXTURE_CATALOG.skill_repos], base, 'fit').map((r) => r.name)).toEqual(['beta-ts', 'alpha-skills', 'zeta'])
})

test('search matches any field, case-insensitively, and an empty query matches all', async () => {
  expect(matchesQuery(['Bound delegated work'], 'DELEG')).toBe(true)
  expect(matchesQuery(['Bound delegated work'], 'sandbox')).toBe(false)
  expect(matchesQuery(['x'], '  ')).toBe(true)
})
