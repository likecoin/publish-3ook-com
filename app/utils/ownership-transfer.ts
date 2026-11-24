import { getAddress, isAddress, isAddressEqual, zeroAddress } from 'viem'

export type OwnershipTransferTarget
  = | { type: 'wallet', wallet: `0x${string}` }
    | { type: 'likerId', likerId: string }

// Liker IDs are lowercase on the API, so a pasted "@Name" still resolves.
const LIKER_ID_PATTERN = /^[a-z0-9_-]{1,20}$/

export function parseOwnershipTransferInput(input: string): OwnershipTransferTarget | null {
  const value = input.trim()
  if (/^0x/i.test(value)) {
    // Strict, so a mixed-case address with a broken checksum reads as a typo.
    // Checksummed on the way out: the API keys its user docs by the checksummed form.
    return isAddress(value) && !isAddressEqual(value, zeroAddress)
      ? { type: 'wallet', wallet: getAddress(value) }
      : null
  }
  const likerId = value.replace(/^@/, '').toLowerCase()
  return LIKER_ID_PATTERN.test(likerId) ? { type: 'likerId', likerId } : null
}

export function isSameWallet(a: string | undefined | null, b: string | undefined | null): boolean {
  return (
    !!a
    && !!b
    && isAddress(a, { strict: false })
    && isAddress(b, { strict: false })
    && isAddressEqual(a, b)
  )
}

// The chain moves first and the listing follows through the API, so a failed API
// call leaves the listing naming us while the contract names someone else.
export function getPendingOwnershipSyncWallet({
  listingOwner,
  chainOwner,
  sessionWallet,
}: {
  listingOwner: string | undefined
  chainOwner: string | undefined
  sessionWallet: string | undefined
}): string | null {
  if (!chainOwner || !isSameWallet(listingOwner, sessionWallet)) { return null }
  return isSameWallet(chainOwner, sessionWallet) ? null : chainOwner
}

export const OWNERSHIP_CONFIRM_POLL_INTERVAL_MS = 5_000
export const OWNERSHIP_CONFIRM_TIMEOUT_MS = 3 * 60_000

// The transaction was broadcast but its outcome never came back, so the chain may yet move.
export class OwnershipTransferPendingError extends Error {
  txHash?: `0x${string}`
  constructor(options: { cause?: unknown, txHash?: `0x${string}` } = {}) {
    super('Ownership transfer was broadcast but not confirmed')
    this.name = 'OwnershipTransferPendingError'
    this.cause = options.cause
    this.txHash = options.txHash
  }
}

// A failed read counts as "not yet": one flaky RPC call must not end the wait early.
export async function pollUntilConfirmed(check: () => Promise<boolean>, {
  intervalMs = OWNERSHIP_CONFIRM_POLL_INTERVAL_MS,
  timeoutMs = OWNERSHIP_CONFIRM_TIMEOUT_MS,
  isCancelled = () => false,
  sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
  now = () => Date.now(),
}: {
  intervalMs?: number
  timeoutMs?: number
  isCancelled?: () => boolean
  sleep?: (ms: number) => Promise<void>
  now?: () => number
} = {}): Promise<'confirmed' | 'timeout' | 'cancelled'> {
  const deadline = now() + timeoutMs
  for (;;) {
    if (isCancelled()) { return 'cancelled' }
    const isConfirmed = await check().catch(() => false)
    if (isCancelled()) { return 'cancelled' }
    if (isConfirmed) { return 'confirmed' }
    if (now() >= deadline) { return 'timeout' }
    await sleep(intervalMs)
  }
}
