// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizePublicationDate } from '../app/utils/publicationDate.ts'

test('an ISO date passes through unchanged', () => {
  assert.equal(normalizePublicationDate('2024-01-15'), '2024-01-15')
  assert.equal(normalizePublicationDate('  2024-01-15  '), '2024-01-15')
})

test('a missing date is not an error', () => {
  assert.equal(normalizePublicationDate(undefined), undefined)
  assert.equal(normalizePublicationDate(''), undefined)
  assert.equal(normalizePublicationDate('   '), undefined)
})

// The formats a spreadsheet hands an author. Each one used to reach
// toISOString and abort the whole book with "Invalid time value".
test('a date Date cannot parse is dropped, never thrown on', () => {
  for (const value of ['2016年3月15日', '2016年3月', '15/03/2016', '民國105年', '2024-13-01', 'n/a']) {
    assert.equal(normalizePublicationDate(value), undefined, value)
  }
})

// Slash dates parse as local midnight, so which day they land on depends on the
// runner's timezone — pin the shape only, and prefer YYYY-MM-DD in the CSV.
test('a slash date is accepted but its day is timezone-dependent', () => {
  assert.match(normalizePublicationDate('2024/01/15'), /^\d{4}-\d{2}-\d{2}$/)
})
