// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { getEbookContentUri, getRecordContentUri, hasOpenTierResult, isBulkCoverUploaded, isBulkEbookUploaded, isHttpsUrl, isProtectedTierLink } from '../app/utils/contentUri.ts'

// Synthetic ids throughout: shape-preserving, from no real book.
const FILE_LINK = 'https://files.example.test/11111111-1111-4111-8111-111111111111'
const PROTECTED_LINK = 'https://api.example.test/arweave/v2/link/22222222-2222-4222-8222-222222222222'
const AR_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'

test('content URI prefers ar:// and falls back to the link', () => {
  assert.equal(getRecordContentUri({ arweaveId: AR_ID, arweaveLink: 'https://gw.example.test/' + AR_ID }), `ar://${AR_ID}`)
  assert.equal(getRecordContentUri({ arweaveLink: FILE_LINK }), FILE_LINK)
  assert.equal(getRecordContentUri({}), '')
})

test('a GCS-only open upload counts as an open-tier result; a protected link does not', () => {
  assert.equal(hasOpenTierResult({ arweaveId: AR_ID }), true)
  assert.equal(hasOpenTierResult({ arweaveLink: FILE_LINK }), true)
  assert.equal(hasOpenTierResult({ arweaveLink: PROTECTED_LINK }), false)
  assert.equal(hasOpenTierResult({}), false)
})

const API_ORIGIN = 'https://api.example.test'

test('a protected link is judged by its parsed pathname, not by raw text', () => {
  assert.equal(isProtectedTierLink('https://files.example.test/abc#/arweave/v2/link/x'), false)
  assert.equal(isProtectedTierLink('https://files.example.test/abc?x=/arweave/v2/link/x'), false)
  assert.equal(isProtectedTierLink('http://api.example.test/arweave/v2/link/abc'), false)
  assert.equal(isProtectedTierLink('https://api.example.test/arweave/v2/link/'), false)
  assert.equal(isProtectedTierLink('not a url /arweave/v2/link/abc'), false)
  assert.equal(isProtectedTierLink(`${PROTECTED_LINK}?key=k`), true)
})

test('with a trusted origin, a protected link must be on it', () => {
  assert.equal(isProtectedTierLink('https://files.example.test/arweave/v2/link/abc', API_ORIGIN), false)
  assert.equal(isProtectedTierLink(PROTECTED_LINK, API_ORIGIN), true)
  assert.equal(isProtectedTierLink(`${PROTECTED_LINK}?key=k`, API_ORIGIN), true)
  assert.equal(isProtectedTierLink(PROTECTED_LINK, ['https://other.example.test', API_ORIGIN]), true)
  assert.equal(hasOpenTierResult({ arweaveLink: PROTECTED_LINK }, API_ORIGIN), false)
  assert.equal(hasOpenTierResult({ arweaveLink: 'https://files.example.test/arweave/v2/link/abc' }, API_ORIGIN), true)
})

test('a spoofed protected link does not satisfy a DRM ebook', () => {
  const spoof = 'https://files.example.test/abc#/arweave/v2/link/x'
  assert.equal(isBulkEbookUploaded({ enableDRM: true, bookArweaveLink: spoof }), false)
  assert.equal(isBulkEbookUploaded({ enableDRM: true, bookArweaveLink: PROTECTED_LINK }, API_ORIGIN), true)
  assert.equal(isBulkEbookUploaded({ enableDRM: true, bookArweaveLink: 'https://files.example.test/arweave/v2/link/abc' }, API_ORIGIN), false)
  assert.equal(isBulkEbookUploaded({ enableDRM: true, bookArweaveId: AR_ID, bookArweaveKey: 'k', bookArweaveLink: FILE_LINK }), false)
})

test('only API links under /arweave/v2/link/ are protected-tier links', () => {
  assert.equal(isProtectedTierLink(PROTECTED_LINK), true)
  assert.equal(isProtectedTierLink(FILE_LINK), false)
  assert.equal(isProtectedTierLink(''), false)
  assert.equal(isProtectedTierLink(undefined), false)
})

test('a bulk cover with only a link counts as uploaded', () => {
  assert.equal(isBulkCoverUploaded({ coverFileLink: FILE_LINK }), true)
  assert.equal(isBulkCoverUploaded({ coverArweaveId: AR_ID }), true)
  assert.equal(isBulkCoverUploaded({}), false)
})

test('a DRM-off ebook counts as uploaded by an open-tier result, never a protected link', () => {
  assert.equal(isBulkEbookUploaded({ enableDRM: false, bookArweaveLink: FILE_LINK }), true)
  assert.equal(isBulkEbookUploaded({ enableDRM: false, bookArweaveId: AR_ID }), true)
  assert.equal(isBulkEbookUploaded({ enableDRM: false, bookArweaveLink: PROTECTED_LINK }), false)
  assert.equal(isBulkEbookUploaded({ enableDRM: false }), false)
})

test('a DRM ebook counts as uploaded only by a protected link or a legacy keyed record', () => {
  assert.equal(isBulkEbookUploaded({ enableDRM: true, bookArweaveLink: PROTECTED_LINK }), true)
  assert.equal(isBulkEbookUploaded({ enableDRM: true, bookArweaveLink: FILE_LINK }), false)
  assert.equal(isBulkEbookUploaded({ enableDRM: true, bookArweaveId: AR_ID }), false)
  assert.equal(isBulkEbookUploaded({ enableDRM: true, bookArweaveId: AR_ID, bookArweaveKey: 'k', bookArweaveLink: `${FILE_LINK}?key=k` }), true)
  assert.equal(isBulkEbookUploaded({ enableDRM: true }), false)
})

test('a keyed legacy record is encrypted, so it is not a DRM-off result', () => {
  assert.equal(isBulkEbookUploaded({ enableDRM: false, bookArweaveId: AR_ID, bookArweaveKey: 'k' }), false)
})

// Every accepted result must publish a URL that matches the DRM mode.
const KEYED_LINK = `${FILE_LINK}?key=k`
const combos = []
for (const hasId of [false, true]) {
  for (const hasKey of [false, true]) {
    for (const link of [undefined, FILE_LINK, PROTECTED_LINK, KEYED_LINK]) {
      combos.push({
        bookArweaveId: hasId ? AR_ID : undefined,
        bookArweaveKey: hasKey ? 'k' : undefined,
        bookArweaveLink: link,
      })
    }
  }
}

test('an accepted DRM result publishes a protected or keyed link, never a public URL', () => {
  for (const combo of combos) {
    const book = { enableDRM: true, ...combo }
    if (!isBulkEbookUploaded(book, API_ORIGIN)) { continue }
    const url = getEbookContentUri({ arweaveId: combo.bookArweaveId, arweaveKey: combo.bookArweaveKey, arweaveLink: combo.bookArweaveLink })
    assert.ok(isProtectedTierLink(url, API_ORIGIN) || (combo.bookArweaveKey && url === combo.bookArweaveLink), JSON.stringify(combo))
  }
})

test('an accepted DRM-off result publishes ar:// or a public link, never a protected or keyed one', () => {
  for (const combo of combos) {
    const book = { enableDRM: false, ...combo }
    if (!isBulkEbookUploaded(book, API_ORIGIN)) { continue }
    const url = getEbookContentUri({ arweaveId: combo.bookArweaveId, arweaveKey: combo.bookArweaveKey, arweaveLink: combo.bookArweaveLink })
    assert.ok(!combo.bookArweaveKey && !isProtectedTierLink(url, API_ORIGIN) && url, JSON.stringify(combo))
  }
})

test('DRM on: a protected link with an unkeyed Arweave id is not uploaded, since ar:// would win', () => {
  const book = { enableDRM: true, bookArweaveId: AR_ID, bookArweaveLink: PROTECTED_LINK }
  assert.equal(isBulkEbookUploaded(book, API_ORIGIN), false)
  assert.equal(isBulkEbookUploaded({ enableDRM: true, bookArweaveLink: PROTECTED_LINK }, API_ORIGIN), true)
  assert.equal(isBulkEbookUploaded({ enableDRM: true, bookArweaveId: AR_ID, bookArweaveKey: 'k', bookArweaveLink: KEYED_LINK }, API_ORIGIN), true)
})

test('isHttpsUrl accepts only a well-formed https URL', () => {
  assert.equal(isHttpsUrl('https://files.example.test/abc'), true)
  assert.equal(isHttpsUrl('  https://files.example.test/abc  '), true)
  for (const bad of ['http://files.example.test/abc', 'ar://abc', 'javascript:alert(1)', 'not a url', '', undefined]) {
    assert.equal(isHttpsUrl(bad), false, String(bad))
  }
})
