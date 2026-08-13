// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { mergeIscnFileLinks } from '../app/utils/iscnFileLinks.ts'

// Synthetic ids throughout: shape-preserving, from no real book.
const EPUB_URL = 'ar://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'
const EPUB_HASH = 'hash://sha256/1111111111111111111111111111111111111111111111111111111111111111'
const PDF_URL = 'ar://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2'
const PDF_HASH = 'hash://sha256/2222222222222222222222222222222222222222222222222222222222222222'
const NEW_EPUB_URL = 'ar://cccccccccccccccccccccccccccccccccccccccccc3'
const NEW_EPUB_HASH = 'hash://sha256/3333333333333333333333333333333333333333333333333333333333333333'
const KEYED_EPUB_URL = 'https://api.example.test/arweave/v2/link/dddddddddddddddddddddddddddddddddddddddddd4?key=NOT_A_REAL_KEY'

// A published book with both formats, as buildIscnLinksFromFileRecords leaves it.
function publishedBook() {
  return {
    downloadableUrls: [
      { url: EPUB_URL, type: 'epub', fileName: 'book.epub' },
      { url: PDF_URL, type: 'pdf', fileName: 'book.pdf' },
    ],
    contentFingerprints: [
      { url: EPUB_URL },
      { url: EPUB_HASH },
      { url: PDF_URL },
      { url: PDF_HASH },
    ],
  }
}

const newEpub = {
  downloadableUrls: [{ url: NEW_EPUB_URL, type: 'epub', fileName: 'book-v2.epub' }],
  contentFingerprints: [{ url: NEW_EPUB_URL }, { url: NEW_EPUB_HASH }],
}

const urls = links => links.downloadableUrls.map(row => row.url)
const fingerprints = links => links.contentFingerprints.map(row => row.url)

test('replacing one format keeps the other, in place', () => {
  const merged = mergeIscnFileLinks(publishedBook(), newEpub)
  assert.deepEqual(urls(merged), [NEW_EPUB_URL, PDF_URL])
  assert.equal(merged.downloadableUrls[0].fileName, 'book-v2.epub')
  assert.equal(merged.downloadableUrls[1].type, 'pdf')
})

test('the replaced file loses its own fingerprint, the kept one keeps everything', () => {
  const merged = mergeIscnFileLinks(publishedBook(), newEpub)
  assert.ok(!fingerprints(merged).includes(EPUB_URL))
  assert.ok(fingerprints(merged).includes(PDF_URL))
  assert.ok(fingerprints(merged).includes(PDF_HASH))
  assert.ok(fingerprints(merged).includes(NEW_EPUB_URL))
  assert.ok(fingerprints(merged).includes(NEW_EPUB_HASH))
})

test('the replaced file leaves its plaintext anchor behind, by design', () => {
  const merged = mergeIscnFileLinks(publishedBook(), newEpub)
  assert.ok(fingerprints(merged).includes(EPUB_HASH))
})

test('an encrypted book replaced with an open one drops the keyed fingerprint', () => {
  // Otherwise isContentFingerprintEncrypted's `.some()` keeps hideDownload on
  // forever, and the tier stops following the file it is supposed to follow.
  const encrypted = {
    downloadableUrls: [{ url: KEYED_EPUB_URL, type: 'epub', fileName: 'book.epub' }],
    contentFingerprints: [{ url: KEYED_EPUB_URL }, { url: EPUB_HASH }],
  }
  const merged = mergeIscnFileLinks(encrypted, newEpub)
  assert.deepEqual(urls(merged), [NEW_EPUB_URL])
  assert.ok(!fingerprints(merged).some(url => url.includes('?key=')))
})

test('a format the book did not have is appended, not swapped in', () => {
  const epubOnly = {
    downloadableUrls: [{ url: EPUB_URL, type: 'epub', fileName: 'book.epub' }],
    contentFingerprints: [{ url: EPUB_URL }, { url: EPUB_HASH }],
  }
  const addPdf = {
    downloadableUrls: [{ url: PDF_URL, type: 'pdf', fileName: 'book.pdf' }],
    contentFingerprints: [{ url: PDF_URL }, { url: PDF_HASH }],
  }
  const merged = mergeIscnFileLinks(epubOnly, addPdf)
  assert.deepEqual(urls(merged), [EPUB_URL, PDF_URL])
  assert.deepEqual(fingerprints(merged), [EPUB_URL, EPUB_HASH, PDF_URL, PDF_HASH])
})

test('hand-entered rows of other types survive a replacement', () => {
  const withExtras = publishedBook()
  withExtras.downloadableUrls.push({ url: 'https://example.test/notes', type: 'other', fileName: 'notes' })
  const merged = mergeIscnFileLinks(withExtras, newEpub)
  assert.deepEqual(urls(merged), [NEW_EPUB_URL, PDF_URL, 'https://example.test/notes'])
})

test('the edit form\'s empty seed rows are not carried through', () => {
  const seeded = {
    downloadableUrls: [{ url: '', type: '', fileName: '' }],
    contentFingerprints: [{ url: '' }],
  }
  const merged = mergeIscnFileLinks(seeded, newEpub)
  assert.deepEqual(urls(merged), [NEW_EPUB_URL])
  assert.deepEqual(fingerprints(merged), [NEW_EPUB_URL, NEW_EPUB_HASH])
})

test('re-uploading the same file does not duplicate its rows', () => {
  const merged = mergeIscnFileLinks(publishedBook(), {
    downloadableUrls: [{ url: EPUB_URL, type: 'epub', fileName: 'book.epub' }],
    contentFingerprints: [{ url: EPUB_URL }, { url: EPUB_HASH }],
  })
  // Nothing lost, nothing doubled, nothing reordered.
  assert.deepEqual(merged, publishedBook())
})
