// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { getRecordContentUri, hasOpenTierResult, isBulkCoverUploaded, isBulkEbookUploaded, isHttpsUrl, isProtectedTierLink } from '../app/utils/contentUri.ts'

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

test('a bulk ebook with only a link counts as uploaded', () => {
  assert.equal(isBulkEbookUploaded({ bookArweaveLink: FILE_LINK }), true)
  assert.equal(isBulkEbookUploaded({ bookArweaveId: AR_ID }), true)
  assert.equal(isBulkEbookUploaded({}), false)
})

test('isHttpsUrl accepts only a well-formed https URL', () => {
  assert.equal(isHttpsUrl('https://files.example.test/abc'), true)
  assert.equal(isHttpsUrl('  https://files.example.test/abc  '), true)
  for (const bad of ['http://files.example.test/abc', 'ar://abc', 'javascript:alert(1)', 'not a url', '', undefined]) {
    assert.equal(isHttpsUrl(bad), false, String(bad))
  }
})
