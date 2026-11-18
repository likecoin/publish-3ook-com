// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { buildGenreSuggestPayload } from '../app/utils/genreSuggestPayload.ts'

const book = { title: 'Title', description: 'Short', descriptionFull: 'Full', language: 'zh' }

test('a book without EPUB context sends only title, description and language', () => {
  assert.deepEqual(buildGenreSuggestPayload(book), {
    title: 'Title',
    description: 'Full',
    language: 'zh',
    tableOfContents: undefined,
    contentExcerpt: undefined,
  })
})

test('the short description stands in when the full one is empty', () => {
  assert.equal(buildGenreSuggestPayload({ ...book, descriptionFull: undefined }).description, 'Short')
})

test('EPUB context is passed through', () => {
  const payload = buildGenreSuggestPayload(book, { tableOfContents: '- Ch 1', contentExcerpt: 'Once' })
  assert.equal(payload.tableOfContents, '- Ch 1')
  assert.equal(payload.contentExcerpt, 'Once')
})

test('every field is cut to the API body limit', () => {
  const payload = buildGenreSuggestPayload(
    { title: 'a'.repeat(600), description: '', descriptionFull: 'b'.repeat(12000), language: '' },
    { tableOfContents: 'c'.repeat(12000), contentExcerpt: 'd'.repeat(25000) },
  )
  assert.equal(payload.title.length, 500)
  assert.equal(payload.description.length, 10000)
  assert.equal(payload.tableOfContents.length, 10000)
  assert.equal(payload.contentExcerpt.length, 20000)
  assert.equal(payload.language, undefined)
})

test('empty context fields are left out rather than sent blank', () => {
  const payload = buildGenreSuggestPayload(book, { tableOfContents: '', contentExcerpt: '' })
  assert.equal(payload.tableOfContents, undefined)
  assert.equal(payload.contentExcerpt, undefined)
})
