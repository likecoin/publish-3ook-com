import { parseEventLogs } from 'viem'
import { LIKE_NFT_ABI } from '~/contracts/likeNFT'
import { DEFAULT_MAX_SUPPLY } from '~/constant'
import { formatISCNTxPayload } from '~/utils/iscn'
import type { ISCNFormData } from '~/types/iscn'

export function useNFTClassCreator () {
  const walletStore = useWalletStore()
  const { wallet } = storeToRefs(walletStore)
  const {
    assertSufficientBalanceForTransaction,
    waitForTransactionReceipt
  } = useNFTContractWriter()
  const { writeContractAsync } = useContractWrite()
  const {
    LIKE_NFT_CONTRACT_ADDRESS,
    LIKE_EVM_NFT_TARGET_ADDRESS
  } = useRuntimeConfig().public

  async function createNFTClass (params: {
    iscnFormData: Ref<ISCNFormData>
  }): Promise<{ classId: string; txHash: string }> {
    const { payload, computeISCNSalt } = useISCN({ iscnFormData: params.iscnFormData })

    const contentMetadata = formatISCNTxPayload(payload.value)
    const metadata = {
      ...contentMetadata,
      symbol: 'BOOK',
      image: contentMetadata?.thumbnailUrl || '',
      external_link: contentMetadata?.url || '',
      nft_meta_collection_id: 'nft_book',
      nft_meta_collection_name: 'NFT Book',
      nft_meta_collection_description: 'NFT Book by Liker Land',
      recordTimestamp: new Date().toISOString()
    }

    const salt = computeISCNSalt(wallet.value!)

    const txParams = {
      address: LIKE_NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: LIKE_NFT_ABI,
      functionName: 'newBookNFT' as const,
      args: [
        salt,
        {
          creator: wallet.value!,
          updaters: [wallet.value!, LIKE_EVM_NFT_TARGET_ADDRESS],
          minters: [wallet.value!, LIKE_EVM_NFT_TARGET_ADDRESS],
          config: {
            name: metadata.name,
            symbol: 'BOOK',
            metadata: JSON.stringify(metadata),
            max_supply: DEFAULT_MAX_SUPPLY
          }
        },
        500
      ]
    }

    await assertSufficientBalanceForTransaction({
      wallet: wallet.value!,
      ...txParams
    })

    const txHash = await writeContractAsync(txParams)
    const receipt = await waitForTransactionReceipt({ hash: txHash, confirmations: 2 })

    if (!receipt || receipt.status !== 'success') {
      throw new Error('NFT class creation failed')
    }

    const [bookNFTLog] = parseEventLogs({
      abi: LIKE_NFT_ABI,
      logs: receipt.logs,
      eventName: 'NewBookNFT',
      strict: false
    })

    const classId = (bookNFTLog?.args as unknown as { bookNFT: string })?.bookNFT?.toLowerCase()
    if (!classId) {
      throw new Error('NewBookNFT event not found in receipt')
    }
    return { classId, txHash }
  }

  return { createNFTClass }
}
