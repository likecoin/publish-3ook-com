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
  for (const value of ['2016年3月15日', '2016年3月', '民國105年', 'n/a']) {
    assert.equal(normalizePublicationDate(value), undefined, value)
  }
})

// The shapes a spreadsheet writes back on its own, including the time it appends
// to a cell formatted as a datetime. These used to parse as local midnight and
// land a day early in UTC+8; the day is pinned now, not just the shape.
test('a bare date lands on the same day in every timezone', () => {
  assert.equal(normalizePublicationDate('2024/01/15'), '2024-01-15')
  assert.equal(normalizePublicationDate('2024.01.15'), '2024-01-15')
  assert.equal(normalizePublicationDate('2024-1-5'), '2024-01-05')
  assert.equal(normalizePublicationDate('2024/01/15 00:00:00'), '2024-01-15')
  assert.equal(normalizePublicationDate('2024-01-15T00:00:00'), '2024-01-15')
})

// A timestamp states its own offset, so it is left to Date and converted to UTC.
test('a timestamp keeps its offset', () => {
  assert.equal(normalizePublicationDate('2024-01-15T00:00:00Z'), '2024-01-15')
  assert.equal(normalizePublicationDate('2024-01-15T00:00:00+08:00'), '2024-01-14')
})

// Reading either as a date means picking a convention, and picking the wrong one
// moves the date by months.
test('a date not stating its year first is dropped', () => {
  for (const value of ['01/15/2024', '15/03/2016', '1/5/24']) {
    assert.equal(normalizePublicationDate(value), undefined, value)
  }
})

// Date.UTC rolls an out-of-range part over rather than rejecting it, and maps a
// year under 100 into the 1900s; the round-trip check is what keeps these out.
test('a part that does not survive the round trip is dropped', () => {
  for (const value of ['2024-13-01', '2024/02/31', '2024/00/10', '0024/01/15']) {
    assert.equal(normalizePublicationDate(value), undefined, value)
  }
})

// A mismatched pair is malformed, not a date written in some other convention —
// dropped rather than handed to Date, which would read it as local midnight.
test('a date separated inconsistently is dropped', () => {
  assert.equal(normalizePublicationDate('2024-01/15'), undefined)
  assert.equal(normalizePublicationDate('2024.01-15'), undefined)
})

// Older chain metadata carries these, and the fallback still has to read them.
test('a year or year-month is left to Date', () => {
  assert.equal(normalizePublicationDate('2024'), '2024-01-01')
  assert.equal(normalizePublicationDate('2024-01'), '2024-01-01')
})
