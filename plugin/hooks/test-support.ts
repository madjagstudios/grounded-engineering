import type { FsEntry, On } from 'claude-code'
import type { Catalog, Host } from './catalog'

export const FIXTURE_CATALOG: Catalog = {
  catalog_version: 1, package_version: '0.6.0', repository: 'https://github.com/madjagstudios/grounded-engineering',
  signals: [], categories: ['Agent & Skill Design', 'Verification'],
  practices: [
    { id: 'GE-AS-004', title: 'Bound delegated work', category: 'Agent & Skill Design', subcategory: 'Delegation safety', pattern: 'Scope delegated agents.', rationale: 'Least privilege reduces side effects.', agent_snippet: 'Give delegated work only the tools it needs.', applicability: ['AI_ASSISTED'], control_types: ['PERMISSION'], confidence: 'high', validation_status: 'validated', source_ids: ['S1'], path: 'practices/agent-design/bounded-delegation.md', body: 'Before delegating, define the result.' },
    { id: 'GE-VF-001', title: 'Use the real verification gate', category: 'Verification', subcategory: 'Gates', pattern: 'Run the real gate.', rationale: 'Claims need evidence.', agent_snippet: null, applicability: ['AI_ASSISTED'], control_types: ['CI'], confidence: 'high', validation_status: 'not_validated', source_ids: ['S1'], path: 'practices/verification/real-verification-gate.md', body: 'Run the declared gate before claiming done.' },
    { id: 'GE-VF-004', title: 'Confine agent-executed commands in an OS sandbox', category: 'Verification', subcategory: 'Sandboxing', pattern: 'Run commands in a sandbox.', rationale: 'Limits blast radius.', agent_snippet: null, applicability: ['AI_ASSISTED'], control_types: ['SANDBOX'], confidence: 'high', validation_status: 'validated', source_ids: ['S1'], path: 'practices/verification/sandbox-agent-execution.md', body: 'Use the sandbox where supported.' },
    { id: 'GE-TS-001', title: 'Keep tests close to the code', category: 'Verification', subcategory: 'Testing', pattern: 'Keep tests near the code they cover.', rationale: 'Nearby tests get run.', agent_snippet: null, applicability: ['AI_ASSISTED'], control_types: ['TEST'], confidence: 'medium', validation_status: 'not_validated', source_ids: ['S1'], path: 'practices/verification/colocated-tests.md', body: 'Put the test next to the file it covers.' },
  ],
  skill_repos: [
    { id: 'GE-SR-001', name: 'alpha-skills', repo: 'example/alpha-skills', license: 'MIT', pinned_commit: 'a'.repeat(40), reviewed_on: '2026-10-06', best_for: ['AI_ASSISTED'], tags: ['planning'], summary: 'Planning skills for coding agents.', watch_out_for: 'Opinionated workflow.', install: ['/plugin marketplace add example/alpha-skills', '/plugin install alpha@example'], install_note: null, featured: false },
    { id: 'GE-SR-002', name: 'beta-ts', repo: 'example/beta-ts', license: 'Apache-2.0', pinned_commit: 'b'.repeat(40), reviewed_on: '2026-10-06', best_for: ['AI_ASSISTED'], tags: ['typescript', 'testing'], summary: 'TypeScript testing skills.', watch_out_for: 'Assumes vitest.', install: ['/plugin install beta@example'], install_note: 'Run /setup-beta once in each repo.', featured: false },
  ],
  fit_rules: [
    { card: 'GE-VF-001', when: { all: ['has_tests'], any: [], none: ['has_ci'] }, why: 'Tests exist, but no CI gate runs them.' },
    { card: 'GE-AS-004', when: { all: ['subagents_without_tool_limits'], any: [], none: [] }, why: 'Some subagents have no tool limits.' },
    { card: 'GE-VF-004', when: { all: ['has_claude_md'], any: [], none: ['sandbox_enabled'] }, why: "This repo's settings don't turn on the OS sandbox." },
    { card: 'GE-TS-001', when: { all: ['has_tests'], any: [], none: ['has_ci'] }, why: 'Tests exist without a CI gate.' },
  ],
  sources: [{ id: 'S1', url: 'https://example.com/source' }],
}

const strip = (p: string) => p.replace(/^\.\//, '')
const entriesOf = (dirs: Record<string, string[]>, path: string): FsEntry[] =>
  (dirs[strip(path)] ?? []).map((name): FsEntry => ({ name: name.replace(/\/$/, ''), kind: name.endsWith('/') ? 'dir' : 'file', size: 0, mtimeMs: 0, isLink: false }))

// A Host for unit tests of the core, backed by maps of files and directory listings.
export function fakeHost(files: Record<string, string>, dirs: Record<string, string[]> = {}): Host {
  const fs = {
    read: async (path: string) => {
      const p = strip(path)
      const text = files[p]
      if (text !== undefined) return text
      throw new Error(`ENOENT: ${p}`)
    },
    exists: async (path: string) => strip(path) in files || strip(path) in dirs,
    list: async (path?: string) => entriesOf(dirs, path ?? '.'),
  }
  return { fs, plugin: { root: '/plugin' } }
}

// Answers the plugin's fs calls in hook-level tests. Paths arrive absolute, so each one
// matches the longest repo-relative key it ends with.
export function fakeRepo(on: On, files: Record<string, string>, dirs: Record<string, string[]> = {}) {
  const keys = [...Object.keys(files), ...Object.keys(dirs)].sort((a, b) => b.length - a.length)
  const rel = (p: string) => {
    const path = strip(p)
    return keys.find((k) => path === k || path.endsWith(`/${k}`)) ?? path
  }
  on('fs.read', async (_$, e) => {
    const path = rel(e.path)
    const text = files[path]
    if (text === undefined && e.path.endsWith('/catalog.json')) return { value: JSON.stringify(FIXTURE_CATALOG) }
    return text !== undefined ? { value: text } : { deny: `ENOENT: ${path}` }
  })
  on('fs.exists', async (_$, e) => ({ value: rel(e.path) in files || rel(e.path) in dirs }))
  on('fs.list', async (_$, e) => ({ value: entriesOf(dirs, rel(e.path)) }))
}

// An adoption manifest in the shape the CLI's buildManifest writes (the core tests' MANIFEST),
// adopting the given cards under the given pack.
export function cliManifest(packId: string, cardIds: string[]): string {
  const cards = cardIds.map((id) => `  - id: ${id}\n    public_disposition: recommended\n    local_applicability: applies\n    source_refs:\n      - S1\n`).join('')
  return `record_type: adoption_manifest\nmanifest_version: 1.0.0\nschema_version: 1.0.0\ngrounded_engineering_release: 0.5.0\npack_id: ${packId}\npack_version: 1.0.0\ncards:\n${cards}targets:\n  - path: AGENTS.md\n    kind: agents-md\n    precondition_sha256: absent\n    managed_block_sha256: ${'a'.repeat(64)}\nvalidation:\n  status: valid\n`
}
