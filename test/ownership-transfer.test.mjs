// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getPendingOwnershipSyncWallet,
  getReservedNftCount,
  isNonexistentTokenError,
  isSameWallet,
  parseOwnershipTransferInput,
  pollUntilConfirmed,
} from '../app/utils/ownership-transfer.ts'

const OWNER = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const NEW_OWNER = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359'

test('parseOwnershipTransferInput accepts a wallet address and checksums it', () => {
  assert.deepEqual(parseOwnershipTransferInput(` ${OWNER} `), { type: 'wallet', wallet: OWNER })
  assert.deepEqual(
    parseOwnershipTransferInput(OWNER.toLowerCase()),
    { type: 'wallet', wallet: OWNER },
  )
})

test('parseOwnershipTransferInput rejects a malformed or burn address', () => {
  assert.equal(parseOwnershipTransferInput('0x1234'), null)
  // One flipped letter breaks the checksum, which is the typo this guards against.
  assert.equal(parseOwnershipTransferInput(OWNER.replace('aAeb', 'aaeb')), null)
  assert.equal(parseOwnershipTransferInput('0x0000000000000000000000000000000000000000'), null)
})

test('parseOwnershipTransferInput normalises a liker ID', () => {
  assert.deepEqual(parseOwnershipTransferInput('@JustBooks'), { type: 'likerId', likerId: 'justbooks' })
  assert.deepEqual(parseOwnershipTransferInput('just-books_1'), { type: 'likerId', likerId: 'just-books_1' })
})

test('parseOwnershipTransferInput rejects an invalid liker ID', () => {
  assert.equal(parseOwnershipTransferInput(''), null)
  assert.equal(parseOwnershipTransferInput('@'), null)
  assert.equal(parseOwnershipTransferInput('just books'), null)
  assert.equal(parseOwnershipTransferInput('a'.repeat(21)), null)
})

test('isSameWallet ignores case and rejects missing values', () => {
  assert.equal(isSameWallet(OWNER, OWNER.toLowerCase()), true)
  assert.equal(isSameWallet(OWNER, NEW_OWNER), false)
  assert.equal(isSameWallet(OWNER, undefined), false)
  assert.equal(isSameWallet('not-a-wallet', 'not-a-wallet'), false)
})

test('getPendingOwnershipSyncWallet flags a chain transfer the listing missed', () => {
  assert.equal(getPendingOwnershipSyncWallet({
    listingOwner: OWNER,
    chainOwner: NEW_OWNER,
    sessionWallet: OWNER.toLowerCase(),
  }), NEW_OWNER)
})

test('getPendingOwnershipSyncWallet stays quiet when nothing is pending', () => {
  assert.equal(getPendingOwnershipSyncWallet({
    listingOwner: OWNER,
    chainOwner: OWNER,
    sessionWallet: OWNER,
  }), null)
  // Only the wallet the listing names can sync it.
  assert.equal(getPendingOwnershipSyncWallet({
    listingOwner: OWNER,
    chainOwner: NEW_OWNER,
    sessionWallet: NEW_OWNER,
  }), null)
  assert.equal(getPendingOwnershipSyncWallet({
    listingOwner: OWNER,
    chainOwner: undefined,
    sessionWallet: OWNER,
  }), null)
})

// A fake clock: each sleep advances time instead of waiting.
function fakeTimer() {
  let time = 0
  return {
    now: () => time,
    sleep: async (ms) => { time += ms },
  }
}

test('pollUntilConfirmed resolves once the check passes', async () => {
  let calls = 0
  const result = await pollUntilConfirmed(async () => ++calls === 3, { ...fakeTimer(), intervalMs: 10, timeoutMs: 100 })
  assert.equal(result, 'confirmed')
  assert.equal(calls, 3)
})

test('pollUntilConfirmed treats a failed read as not yet confirmed', async () => {
  let calls = 0
  const result = await pollUntilConfirmed(async () => {
    calls += 1
    if (calls === 1) { throw new Error('rpc down') }
    return true
  }, { ...fakeTimer(), intervalMs: 10, timeoutMs: 100 })
  assert.equal(result, 'confirmed')
})

test('pollUntilConfirmed times out when the check never passes', async () => {
  let calls = 0
  const result = await pollUntilConfirmed(async () => { calls += 1; return false }, { ...fakeTimer(), intervalMs: 10, timeoutMs: 30 })
  assert.equal(result, 'timeout')
  assert.equal(calls, 4)
})

test('pollUntilConfirmed stops when cancelled, even after a passing check', async () => {
  let isCancelled = false
  const result = await pollUntilConfirmed(async () => { isCancelled = true; return true }, {
    ...fakeTimer(),
    isCancelled: () => isCancelled,
  })
  assert.equal(result, 'cancelled')
})

test('getReservedNftCount reserves #0 only while the wallet holds it', () => {
  assert.equal(getReservedNftCount(OWNER, OWNER.toLowerCase()), 1)
  // Moved with the book, or handed over by script before this feature.
  assert.equal(getReservedNftCount(NEW_OWNER, OWNER), 0)
  // Burnt, or the read failed.
  assert.equal(getReservedNftCount(null, OWNER), 0)
  assert.equal(getReservedNftCount(OWNER, undefined), 0)
})

test('isNonexistentTokenError finds the revert anywhere in the cause chain', () => {
  const revert = Object.assign(new Error('reverted'), { data: { errorName: 'ERC721NonexistentToken' } })
  assert.equal(isNonexistentTokenError(revert), true)
  assert.equal(isNonexistentTokenError(new Error('call failed', { cause: revert })), true)
})

test('isNonexistentTokenError leaves other failures unexplained', () => {
  assert.equal(isNonexistentTokenError(new Error('fetch failed')), false)
  const otherRevert = Object.assign(new Error('reverted'), { data: { errorName: 'ERC721InvalidOwner' } })
  assert.equal(isNonexistentTokenError(new Error('call failed', { cause: otherRevert })), false)
  assert.equal(isNonexistentTokenError(undefined), false)
})
