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
    formData: { genre: '', tags: [], ...formData },
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
