import { LIKE_NFT_CLASS_ABI } from '~/contracts/likeNFT'
import type { ClassListingData } from '~/types'
import {
  getPendingOwnershipSyncWallet,
  isNonexistentTokenError,
  isSameWallet,
  OwnershipTransferPendingError,
  RESERVED_NFT_TOKEN_ID,
} from '~/utils/ownership-transfer'
import { SponsoredTransactionBroadcastError, type SponsoredWriteContractParams } from './useSponsoredTransaction'

// Signing, two confirmations and the sync rarely take this long; a session ending sooner is refused up front.
const TRANSFER_SESSION_MARGIN_MS = 10 * 60_000

export function useBookOwnershipTransfer() {
  const { t: $t } = useI18n()
  const walletStore = useWalletStore()
  const { writeContractAsync } = useContractWrite()
  const { assertSufficientBalanceForTransaction, waitForTransactionReceipt } = useNFTContractWriter()
  const { getClassOwner, getNFTOwner } = useNFTContractReader()
  const bookstoreApiStore = useBookstoreApiStore()
  const { transferBookOwnership } = bookstoreApiStore
  const { showErrorToast } = useToastComposable()
  const apiFetch = useLikeCoApiFetch()

  // An API session can outlive the wagmi connection, so reconnect and match it first.
  async function ensureWalletConnected() {
    await walletStore.validateWalletConsistency()
    if (!walletStore.wallet) {
      throw new Error('WALLET_NOT_INITED')
    }
  }

  async function transferOnChain({ classId, newOwnerWallet, onSubmitted }: {
    classId: string
    newOwnerWallet: `0x${string}`
    onSubmitted?: () => void
  }) {
    const params = {
      address: classId as `0x${string}`,
      abi: LIKE_NFT_CLASS_ABI,
      functionName: 'transferOwnership',
      args: [newOwnerWallet],
    }
    // The chain cannot be undone, and an expired session would leave the listing behind it.
    if (!checkJwtTokenValidFor(bookstoreApiStore.token, TRANSFER_SESSION_MARGIN_MS)) {
      throw new Error($t('ownership_transfer.error_session_expired'))
    }
    await ensureWalletConnected()
    await assertSufficientBalanceForTransaction({ wallet: walletStore.wallet!, ...params })
    return writeAndConfirm(params, { confirmations: 2, onSubmitted })
  }

  // Once broadcast, a lost answer is not a failure: it throws OwnershipTransferPendingError instead.
  async function writeAndConfirm(params: SponsoredWriteContractParams, { confirmations, onSubmitted }: {
    confirmations?: number
    onSubmitted?: () => void
  } = {}) {
    let txHash: `0x${string}`
    try {
      txHash = await writeContractAsync(params)
    }
    catch (error) {
      if (error instanceof SponsoredTransactionBroadcastError) {
        throw new OwnershipTransferPendingError({ cause: error })
      }
      throw error
    }
    onSubmitted?.()
    const receipt = await waitForTransactionReceipt({ hash: txHash, confirmations })
      .catch((error) => { throw new OwnershipTransferPendingError({ cause: error, txHash }) })
    if (receipt.status !== 'success') {
      throw new Error($t('ownership_transfer.error_reverted', { txHash }))
    }
    return txHash
  }

  async function fetchReservedNftHolder(classId: string) {
    try {
      return await getNFTOwner(classId, RESERVED_NFT_TOKEN_ID)
    }
    catch (error) {
      if (isNonexistentTokenError(error)) { return null }
      throw error
    }
  }

  // A missing, sold or already moved copy is skipped rather than failing the handover.
  async function transferReservedNft({ classId, fromWallet, toWallet }: {
    classId: string
    fromWallet: `0x${string}`
    toWallet: `0x${string}`
  }) {
    const holder = await fetchReservedNftHolder(classId)
    if (!isSameWallet(holder, fromWallet)) { return }
    const params = {
      address: classId as `0x${string}`,
      abi: LIKE_NFT_CLASS_ABI,
      functionName: 'transferFrom',
      args: [fromWallet, toWallet, BigInt(RESERVED_NFT_TOKEN_ID)],
    }
    await ensureWalletConnected()
    await assertSufficientBalanceForTransaction({ wallet: fromWallet, ...params })
    await writeAndConfirm(params)
  }

  // Runs after the listing sync, so a failure here only warns and never holds the handover back.
  async function transferReservedNftOrWarn(params: Parameters<typeof transferReservedNft>[0]) {
    try {
      await transferReservedNft(params)
    }
    catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      // Only a failure before broadcast, or a revert, proves the copy never left.
      const message = error instanceof OwnershipTransferPendingError
        ? $t('ownership_transfer.error_reserved_nft_unconfirmed')
        : $t('ownership_transfer.error_reserved_nft')
      showErrorToast(message, { duration: 10000 })
    }
  }

  async function fetchPendingSyncWallet({ classId, listingOwner, sessionWallet }: {
    classId: string
    listingOwner: string | undefined
    sessionWallet: string | undefined
  }) {
    const chainOwner = await getClassOwner(classId)
    return getPendingOwnershipSyncWallet({ listingOwner, chainOwner, sessionWallet })
  }

  // The listing can move even when the call fails (a lost response, or the API's
  // Airtable step), and a retry would then be refused as no longer the owner.
  async function syncOwnership(classId: string, payload: { newOwnerWallet: string, txHash?: string }) {
    try {
      await transferBookOwnership(classId, payload)
    }
    catch (error) {
      const listing = await apiFetch<ClassListingData>(`/likernft/book/store/${classId}`).catch(() => null)
      if (!isSameWallet(listing?.ownerWallet, payload.newOwnerWallet)) { throw error }
    }
  }

  return {
    transferOnChain,
    transferReservedNftOrWarn,
    fetchReservedNftHolder,
    syncOwnership,
    fetchPendingSyncWallet,
  }
}
