import test from 'node:test'
import assert from 'node:assert/strict'

import { checkLikerIdValid, getCanonicalLikerId } from '../app/utils/liker-id.ts'

test('canonicalizes a username to its stored form', () => {
  assert.equal(getCanonicalLikerId('  @MyName_1 '), 'myname_1')
  assert.equal(getCanonicalLikerId('plain'), 'plain')
  assert.equal(getCanonicalLikerId(''), '')
})

test('accepts only lowercase letters, digits, hyphens and underscores', () => {
  assert.equal(checkLikerIdValid('abc-12_x'), true)
  assert.equal(checkLikerIdValid('Abcde'), false)
  assert.equal(checkLikerIdValid('abc de'), false)
  assert.equal(checkLikerIdValid('名稱名稱名稱'), false)
})

test('enforces the 5 to 20 character length', () => {
  assert.equal(checkLikerIdValid('abcd'), false)
  assert.equal(checkLikerIdValid('abcde'), true)
  assert.equal(checkLikerIdValid('a'.repeat(20)), true)
  assert.equal(checkLikerIdValid('a'.repeat(21)), false)
})
