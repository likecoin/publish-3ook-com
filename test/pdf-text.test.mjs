// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PDF_TEXT_MIN_CHARS_PER_PAGE,
  PDF_TEXT_SAMPLE_PAGES,
  samplePdfPageNumbers,
  hasSearchableText,
  countPagesWithText,
} from '../app/utils/pdf-text.ts'

const sample = (pageCount, size = PDF_TEXT_SAMPLE_PAGES) =>
  samplePdfPageNumbers(pageCount, size)

// A page of prose, and a page carrying nothing but a stamped folio.
const PROSE = 900
const FOLIO = 12

test('spreads the sample across the book and never reads page one', () => {
  const pages = sample(100)
  assert.equal(pages.length, PDF_TEXT_SAMPLE_PAGES)
  // Snapshotted rather than described: the spread is the rule, so a change to
  // the bucket arithmetic should have to be stated here.
  assert.deepEqual(pages, [8, 20, 32, 45, 57, 70, 82, 94])
})

test('keeps every sample in range, ascending and unique', () => {
  for (const pageCount of [2, 3, 5, 9, 10, 17, 64, 401, 2000]) {
    const pages = sample(pageCount)
    assert.ok(pages.length <= PDF_TEXT_SAMPLE_PAGES, `${pageCount}: too many`)
    assert.ok(pages.length > 0, `${pageCount}: empty`)
    assert.equal(new Set(pages).size, pages.length, `${pageCount}: duplicates`)
    for (const [i, page] of pages.entries()) {
      assert.ok(page >= 2, `${pageCount}: read page ${page}`)
      assert.ok(page <= pageCount, `${pageCount}: past the end at ${page}`)
      if (i) { assert.ok(page > pages[i - 1], `${pageCount}: out of order`) }
    }
  }
})

// A book long enough to have back matter should not be judged on its last page,
// which is as often blank or a colophon as it is prose.
test('leaves the last page alone once there is room to', () => {
  for (const pageCount of [20, 64, 401]) {
    assert.ok(!sample(pageCount).includes(pageCount), `${pageCount}`)
  }
})

test('reads what it can of a book too short to spread over', () => {
  assert.deepEqual(sample(2), [2])
  assert.deepEqual(sample(3), [2, 3])
  assert.deepEqual(sample(9), [2, 3, 4, 5, 6, 7, 8, 9])
})

test('has nothing to sample in a document of one page or less', () => {
  for (const pageCount of [1, 0, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(sample(pageCount), [], `${pageCount}`)
  }
})

// Production never passes a size — useEbookProcessing calls it with the page
// count alone — so the default is the only path that ships.
test('defaults to the shipped sample size', () => {
  assert.deepEqual(samplePdfPageNumbers(100), sample(100, PDF_TEXT_SAMPLE_PAGES))
  assert.equal(samplePdfPageNumbers(100).length, PDF_TEXT_SAMPLE_PAGES)
})

test('refuses to sample when asked for no pages', () => {
  for (const size of [0, -1, Number.NaN]) {
    assert.deepEqual(sample(100, size), [], `${size}`)
  }
})

test('calls a book of prose searchable', () => {
  assert.equal(hasSearchableText(Array(8).fill(PROSE)), true)
  // Chinese pages carry far fewer characters than English ones for the same
  // content; the threshold has to sit below both.
  assert.equal(hasSearchableText(Array(8).fill(600)), true)
})

test('calls a scan unsearchable', () => {
  assert.equal(hasSearchableText(Array(8).fill(0)), false)
})

// The rule that stops "any page with text" from passing: a scan run through a
// tool that stamped page numbers, or one born-digital colophon bound into it.
test('is not fooled by a scan carrying page numbers or one text page', () => {
  assert.equal(hasSearchableText(Array(8).fill(FOLIO)), false)
  assert.equal(hasSearchableText([0, 0, 0, PROSE, 0, 0, 0, 0]), false)
  assert.equal(hasSearchableText([FOLIO, FOLIO, PROSE, FOLIO, FOLIO, FOLIO, FOLIO, FOLIO]), false)
})

// The rule that stops "most pages" from being required: plate sections and
// blank pages are normal in a book that is otherwise all text.
test('allows a text book its plates and blank pages', () => {
  assert.equal(hasSearchableText([0, 0, PROSE, 0, 0, PROSE, 0, PROSE]), true)
  assert.equal(hasSearchableText([PROSE, PROSE, PROSE, 0, 0, 0, 0, 0]), true)
})

test('judges a short sample by the same third', () => {
  assert.equal(hasSearchableText([PROSE]), true)
  assert.equal(hasSearchableText([0]), false)
  assert.equal(hasSearchableText([PROSE, 0, 0]), true)
  assert.equal(hasSearchableText([PROSE, 0, 0, 0]), false)
})

test('has no verdict without a sample', () => {
  assert.equal(hasSearchableText([]), false)
})

test('holds the threshold at the character it is defined on', () => {
  assert.equal(hasSearchableText(Array(8).fill(PDF_TEXT_MIN_CHARS_PER_PAGE)), true)
  assert.equal(hasSearchableText(Array(8).fill(PDF_TEXT_MIN_CHARS_PER_PAGE - 1)), false)
})

test('ignores counts that are not numbers', () => {
  assert.equal(countPagesWithText([PROSE, Number.NaN, undefined, PROSE]), 2)
  assert.equal(countPagesWithText([]), 0)
})
