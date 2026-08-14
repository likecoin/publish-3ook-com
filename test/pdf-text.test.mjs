// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PDF_TEXT_MIN_CHARS_PER_PAGE,
  PDF_TEXT_SAMPLE_PAGES,
  PDF_TEXT_MAX_UNMAPPED_RATIO,
  samplePdfPageNumbers,
  hasSearchableText,
  countPagesWithText,
  legibleCharCount,
  stripUnmappedChars,
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

// Invented rather than lifted out of a real file: these are shaped like what an
// extractor returns, which is all the rules read. A font embedded without a
// ToUnicode CMap decodes to its glyph indices, and those land in the control
// range and the Latin-1 supplement. Escaped, so the fixture can be read.
const GLYPH_INDICES = '\u001F\u001E\u001D\u001C\u001B\u001A\u0019\u0018'
const CJK_PAGE = '這是一頁排版正常的內文，讀者可以搜尋、選取與朗讀。'
const LATIN_PAGE = 'A page of ordinary prose a reader can search and select.'

test('counts an ordinary page in either script as wholly legible', () => {
  assert.equal(legibleCharCount(CJK_PAGE), CJK_PAGE.length)
  assert.equal(legibleCharCount(LATIN_PAGE), LATIN_PAGE.length)
  // The Latin-1 supplement is where half of a garbled CJK page lands, but it is
  // also how a European book spells its own words: it is not evidence by itself.
  const european = 'Cañón, café, größer — ¡Hola!'
  assert.equal(legibleCharCount(european), european.length)
})

test('counts a page of glyph indices as no text at all', () => {
  assert.equal(legibleCharCount(GLYPH_INDICES), 0)
  assert.equal(legibleCharCount(`1 ${GLYPH_INDICES} ¡¢£¤¥¦§¨©`), 0)
  // The private use areas, including the two astral ones, and the replacement
  // character a stricter extractor substitutes for the same missing mapping.
  assert.equal(legibleCharCount('\uE000\uF8FF\u{F0000}\u{100000}\uFFFD'), 0)
})

test('reads whitespace as layout rather than as a failed mapping', () => {
  const spaced = 'a\tb\nc\rd e'
  assert.equal(legibleCharCount(spaced), spaced.length)
  // getTextContent joins positioned runs with spaces, so a page of them is
  // spaces around nothing, not a page of text.
  assert.equal(legibleCharCount('   \n\t '), 0)
  assert.equal(legibleCharCount(''), 0)
})

// The margin that keeps a mixed page: a running header set in the one broken
// font should not cost the reader the prose underneath it.
test('keeps a page whose prose outweighs a garbled header', () => {
  const page = `${GLYPH_INDICES} ${CJK_PAGE.repeat(8)}`
  assert.equal(legibleCharCount(page), page.length)
})

test('holds the threshold at the ratio it is defined on', () => {
  const VISIBLE = 20
  const page = unmapped => 'x'.repeat(VISIBLE - unmapped) + '\u0001'.repeat(unmapped)
  const allowed = Math.floor(VISIBLE * PDF_TEXT_MAX_UNMAPPED_RATIO)
  assert.equal(legibleCharCount(page(allowed)), VISIBLE)
  assert.equal(legibleCharCount(page(allowed + 1)), 0)
})

// How the composable takes the second verdict: a garbled page contributes zero
// legible characters, so the one-third rule that already answers the scan
// answers this too, unchanged.
test('judges a garbled book by the same third', () => {
  const garbled = legibleCharCount(GLYPH_INDICES)
  const prose = legibleCharCount(CJK_PAGE.repeat(4))

  assert.equal(hasSearchableText(Array(8).fill(prose)), true)
  assert.equal(hasSearchableText(Array(8).fill(garbled)), false)
  // A book legible only in one short stretch is still a book the reader cannot
  // search, so the stretch must not carry the verdict on its own.
  assert.equal(hasSearchableText([prose, garbled, garbled, garbled, garbled]), false)
})

test('strips what failed to decode without touching the text around it', () => {
  assert.equal(stripUnmappedChars(CJK_PAGE), CJK_PAGE)
  assert.equal(stripUnmappedChars(`${GLYPH_INDICES} ${LATIN_PAGE}`), LATIN_PAGE)
  // A removed run leaves the spaces that surrounded it adjacent.
  assert.equal(stripUnmappedChars(`a ${GLYPH_INDICES} b`), 'a b')
  assert.equal(stripUnmappedChars(GLYPH_INDICES), '')
})
