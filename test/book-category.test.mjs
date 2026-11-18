// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { BOOK_CATEGORIES } from '../app/constant/bookCategories.ts'
import { getBookCategoryName, resolveBookCategory } from '../app/utils/bookCategory.ts'

const resolve = input => resolveBookCategory(input, BOOK_CATEGORIES)

test('a blank cell sets no category', () => {
  assert.equal(resolve(undefined), undefined)
  assert.equal(resolve(''), undefined)
  assert.equal(resolve('   '), undefined)
})

test('the stored value, which is also the English name, resolves in any case', () => {
  assert.equal(resolve('Fiction'), 'Fiction')
  assert.equal(resolve('  fiction '), 'Fiction')
  assert.equal(resolve('SELF-HELP'), 'Self-Help')
})

test('the Chinese name resolves to the stored value', () => {
  assert.equal(resolve('小說'), 'Fiction')
  assert.equal(resolve(' 身心靈 '), 'Mind, Body, Spirit')
})

// The page language picks the menu names but never narrows what a CSV may use.
test('either name resolves whichever locale the menu shows', () => {
  for (const locale of ['en', 'zh']) {
    const shown = getBookCategoryName(BOOK_CATEGORIES.find(c => c.value === 'Fiction'), locale)
    assert.equal(resolve(shown), 'Fiction')
  }
  assert.equal(getBookCategoryName(BOOK_CATEGORIES[0], 'en'), BOOK_CATEGORIES[0].value)
  assert.equal(getBookCategoryName(BOOK_CATEGORIES[0], 'zh'), BOOK_CATEGORIES[0].zh)
})

// The comma inside "Mind, Body, Spirit" is why a cell holds one category only.
test('a value containing a comma is one category, not a list', () => {
  assert.equal(resolve('Mind, Body, Spirit'), 'Mind, Body, Spirit')
  assert.equal(resolve('Fiction,Self-Help'), undefined)
})

test('an unknown category does not resolve', () => {
  assert.equal(resolve('Novels'), undefined)
  assert.equal(resolve('小'), undefined)
})

test('every name maps back to exactly one category', () => {
  const names = BOOK_CATEGORIES.flatMap(c => [c.value.toLowerCase(), c.zh])
  assert.equal(new Set(names).size, names.length)
  for (const category of BOOK_CATEGORIES) {
    assert.equal(resolve(category.value), category.value)
    assert.equal(resolve(category.zh), category.value)
  }
})
