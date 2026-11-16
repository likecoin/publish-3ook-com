// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getStoreMetadataDrift,
  getStoreSourcedFields,
  mergeBookKeywords,
} from '../app/utils/store-metadata-drift.ts'

// The fill / union / conflict split is the whole correctness surface of the
// drift feature: fill and union are written into the form for the author to
// sign, so a rule that overwrites instead of merging would push a stale store
// value on chain and lose whatever the author had set.
const GENRE_VOCABULARY = ['Art', 'Fiction', 'Poetry']
const MAX_KEYWORDS = 20

function drift({ listing = {}, formData = {} } = {}) {
  return getStoreMetadataDrift({
    listing,
    formData: {
      genre: '',
      tags: [],
      title: '',
      alternativeHeadline: '',
      publicationDate: '',
      isbn: '',
      ...formData,
    },
    genreVocabulary: GENRE_VOCABULARY,
    maxKeywords: MAX_KEYWORDS,
  })
}

test('an empty chain genre is filled from the store', () => {
  const { staged, conflicts } = drift({ listing: { genre: 'Poetry' } })
  assert.equal(staged.genre, 'Poetry')
  assert.deepEqual(conflicts, [])
})

test('a differing chain genre is a conflict, never staged', () => {
  const { staged, conflicts } = drift({
    listing: { genre: 'Poetry' },
    formData: { genre: 'Fiction' },
  })
  assert.equal(staged.genre, undefined)
  assert.deepEqual(conflicts, [{ field: 'genre', storeValue: 'Poetry' }])
})

test('a matching genre is neither staged nor flagged', () => {
  const { staged, conflicts } = drift({
    listing: { genre: 'Poetry' },
    formData: { genre: 'Poetry' },
  })
  assert.deepEqual(staged, {})
  assert.deepEqual(conflicts, [])
})

test('an off-vocabulary store genre is ignored entirely', () => {
  const { staged, conflicts } = drift({ listing: { genre: 'Definitely Not A Category' } })
  assert.deepEqual(staged, {})
  assert.deepEqual(conflicts, [])
})

test('keywords union keeps the chain order and appends the store additions', () => {
  const { staged } = drift({
    listing: { keywords: ['詩', 'poetry', 'anthology'] },
    formData: { tags: ['poetry', '香港'] },
  })
  assert.deepEqual(staged.tags, ['poetry', '香港', '詩', 'anthology'])
})

test('keywords already covered by the chain stage nothing', () => {
  const { staged } = drift({
    listing: { keywords: ['Poetry'] },
    formData: { tags: ['poetry'] },
  })
  assert.equal(staged.tags, undefined)
})

test('a comma-separated store keyword string is accepted', () => {
  const { staged } = drift({ listing: { keywords: ' poetry , anthology ,, ' } })
  assert.deepEqual(staged.tags, ['poetry', 'anthology'])
})

test('the union is capped at the field maximum', () => {
  const chainTags = Array.from({ length: 19 }, (_, index) => `chain-${index}`)
  const { staged } = drift({
    listing: { keywords: ['store-a', 'store-b'] },
    formData: { tags: chainTags },
  })
  assert.equal(staged.tags.length, MAX_KEYWORDS)
  assert.equal(staged.tags.at(-1), 'store-a')
})

test('nothing is staged when the chain is already at the cap', () => {
  const chainTags = Array.from({ length: MAX_KEYWORDS }, (_, index) => `chain-${index}`)
  const { staged } = drift({
    listing: { keywords: ['store-a'] },
    formData: { tags: chainTags },
  })
  assert.equal(staged.tags, undefined)
})

test('an empty chain subtitle, ISBN and date are filled from the store', () => {
  const { staged, conflicts } = drift({
    listing: { alternativeHeadline: ' 副標題 ', isbn: '9786266531625', datePublished: '2024-01-15' },
  })
  assert.deepEqual(staged, {
    alternativeHeadline: '副標題',
    isbn: '9786266531625',
    publicationDate: '2024-01-15',
  })
  assert.deepEqual(conflicts, [])
})

test('a differing chain title is a conflict, never staged', () => {
  const { staged, conflicts } = drift({
    listing: { name: '書名' },
    formData: { title: '書名：副標題' },
  })
  assert.equal(staged.title, undefined)
  assert.deepEqual(conflicts, [{ field: 'title', storeValue: '書名' }])
})

test('differing subtitle, ISBN and date are conflicts', () => {
  const { staged, conflicts } = drift({
    listing: { alternativeHeadline: 'New', isbn: '9786266531625', datePublished: '2024-01-15' },
    formData: { alternativeHeadline: 'Old', isbn: '9789570000000', publicationDate: '2023-05-01' },
  })
  assert.deepEqual(staged, {})
  assert.deepEqual(conflicts, [
    { field: 'alternativeHeadline', storeValue: 'New' },
    { field: 'publicationDate', storeValue: '2024-01-15' },
    { field: 'isbn', storeValue: '9786266531625' },
  ])
})

// Formatting differences are not drift:
// flagging them would ask the author to sign a transaction that changes nothing a reader sees.
test('whitespace around the title is not a conflict', () => {
  const { staged, conflicts } = drift({
    listing: { name: ' 書名 ' },
    formData: { title: '書名' },
  })
  assert.deepEqual(staged, {})
  assert.deepEqual(conflicts, [])
})

test('an ISBN differing only in hyphens and case is not a conflict', () => {
  const { conflicts } = drift({
    listing: { isbn: '043942089X' },
    formData: { isbn: '0-439-42089-x' },
  })
  assert.deepEqual(conflicts, [])
})

test('a timestamped store date matches the same chain day', () => {
  const { staged, conflicts } = drift({
    listing: { datePublished: '2024-01-15T00:00:00.000Z' },
    formData: { publicationDate: '2024-01-15' },
  })
  assert.deepEqual(staged, {})
  assert.deepEqual(conflicts, [])
})

test('a store date is staged date-only, as the date input needs it', () => {
  const { staged } = drift({ listing: { datePublished: '2024-01-15T00:00:00.000Z' } })
  assert.equal(staged.publicationDate, '2024-01-15')
})

test('an unparseable store date is ignored', () => {
  const { staged, conflicts } = drift({
    listing: { datePublished: 'not a date' },
    formData: { publicationDate: '2024-01-15' },
  })
  assert.deepEqual(staged, {})
  assert.deepEqual(conflicts, [])
})

test('an empty store value never clears or flags the chain value', () => {
  const { staged, conflicts } = drift({
    listing: { name: '', alternativeHeadline: '  ', isbn: '' },
    formData: { title: '書名', alternativeHeadline: '副標題', isbn: '9786266531625' },
  })
  assert.deepEqual(staged, {})
  assert.deepEqual(conflicts, [])
})

test('store-sourced provenance drops a field the author edited', () => {
  const staged = { genre: 'Poetry', tags: ['poetry', 'anthology'] }
  const formData = { genre: 'Poetry', tags: ['poetry'] }
  assert.deepEqual(getStoreSourcedFields(staged, formData), ['genre'])
})

// mergeBookKeywords is also what the AI suggestion merge runs, so its folding
// rules are load-bearing in two places.
test('the merge folds width and case variants together', () => {
  assert.deepEqual(
    mergeBookKeywords(['Ｐｏｅｔｒｙ'], ['poetry', 'anthology'], MAX_KEYWORDS),
    ['Ｐｏｅｔｒｙ', 'anthology'],
  )
})

test('the merge never displaces what is already there', () => {
  const existing = ['a', 'b']
  assert.deepEqual(mergeBookKeywords(existing, ['c'], 2), existing)
})
