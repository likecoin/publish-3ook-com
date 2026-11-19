import { LIKE_NFT_CLASS_ABI } from '~/contracts/likeNFT'
import type { ClassListingData } from '~/types'
import { getPendingOwnershipSyncWallet, isSameWallet } from '~/utils/ownership-transfer'

export function useBookOwnershipTransfer() {
  const { t: $t } = useI18n()
  const walletStore = useWalletStore()
  const { writeContractAsync } = useContractWrite()
  const { assertSufficientBalanceForTransaction, waitForTransactionReceipt } = useNFTContractWriter()
  const { getClassOwner } = useNFTContractReader()
  const { transferBookOwnership } = useBookstoreApiStore()
  const apiFetch = useLikeCoApiFetch()

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
    // An API session can outlive the wagmi connection, so reconnect and match it first.
    await walletStore.validateWalletConsistency()
    if (!walletStore.wallet) {
      throw new Error('WALLET_NOT_INITED')
    }
    await assertSufficientBalanceForTransaction({ wallet: walletStore.wallet, ...params })
    const txHash = await writeContractAsync(params)
    onSubmitted?.()
    const receipt = await waitForTransactionReceipt({ hash: txHash, confirmations: 2 })
    if (receipt.status !== 'success') {
      throw new Error($t('ownership_transfer.error_reverted', { txHash }))
    }
    return txHash
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
    syncOwnership,
    fetchPendingSyncWallet,
  }
}
