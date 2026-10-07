import { test, expect } from 'claude-code/testing'
import { shorten, room } from './tiles'
import { slimCatalog } from './model'
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
