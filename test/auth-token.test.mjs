// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import { checkJwtTokenValidFor, REQUIRED_SESSION_PERMISSIONS } from '../app/utils/auth.ts'

function makeToken(payload) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode(payload)}.`
}

const MINUTE = 60_000
const tokenExpiringIn = ms => makeToken({
  exp: Math.floor((Date.now() + ms) / 1000),
  permissions: [...REQUIRED_SESSION_PERMISSIONS],
})

test('checkJwtTokenValidFor accepts a session lasting beyond the margin', () => {
  assert.equal(checkJwtTokenValidFor(tokenExpiringIn(30 * MINUTE), 10 * MINUTE), true)
})

test('checkJwtTokenValidFor refuses a session ending within the margin', () => {
  assert.equal(checkJwtTokenValidFor(tokenExpiringIn(5 * MINUTE), 10 * MINUTE), false)
  assert.equal(checkJwtTokenValidFor(tokenExpiringIn(-MINUTE), 10 * MINUTE), false)
})

test('checkJwtTokenValidFor refuses a malformed token', () => {
  assert.equal(checkJwtTokenValidFor('', 10 * MINUTE), false)
  assert.equal(checkJwtTokenValidFor('not-a-jwt', 10 * MINUTE), false)
})
