// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveShortDescription } from '../app/utils/description.ts'

test('returns short text unchanged, trimmed', () => {
  assert.equal(deriveShortDescription('  已經夠短了。  ', 100), '已經夠短了。')
  assert.equal(deriveShortDescription('', 100), '')
})

test('cuts at a CJK sentence ending when one is near the end', () => {
  const text = `${'甲'.repeat(70)}。${'乙'.repeat(60)}`
  assert.equal(deriveShortDescription(text, 100), `${'甲'.repeat(70)}。`)
})

test('cuts at a word boundary when a sentence ending is too far back', () => {
  // The only full stop sits at 10 chars, well under the sentence floor, so the
  // cut falls through to the last space instead of throwing 90 chars away.
  const text = `one. ${'word '.repeat(40)}`
  const result = deriveShortDescription(text, 100)
  assert.ok(result.length <= 100)
  assert.ok(!result.endsWith(' '))
  assert.ok(result.length > 90, `expected a late cut, got ${result.length}`)
})

test('falls back to a plain cut when no boundary is close enough', () => {
  // No punctuation, no spaces — the CJK case the floors exist for.
  const text = '丙'.repeat(300)
  assert.equal(deriveShortDescription(text, 100), '丙'.repeat(100))
})

test('never exceeds the cap', () => {
  for (const max of [10, 50, 100, 1000]) {
    for (const text of ['字'.repeat(5000), 'word '.repeat(1000), `${'a'.repeat(4000)}. b`]) {
      assert.ok(deriveShortDescription(text, max).length <= max)
    }
  }
})
