import { useWriteContract } from '@wagmi/vue'
import { LIKE_NFT_ABI } from '~/contracts/likeNFT'
import { DEFAULT_MAX_SUPPLY } from '~/constant'
import { formatISCNTxPayload } from '~/utils/iscn'
import type { ISCNFormData } from '~/utils/iscn.type'

export function useNFTClassCreator () {
  const walletStore = useWalletStore()
  const { wallet } = storeToRefs(walletStore)
  const {
    assertSufficientBalanceForTransaction,
    waitForTransactionReceipt
  } = useNFTContractWriter()
  const { writeContractAsync } = useWriteContract()
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
    const receipt = await waitForTransactionReceipt({ hash: txHash })

    if (!receipt || receipt.status !== 'success') {
      throw new Error('NFT class creation failed')
    }
    if (!receipt.logs?.[0]?.address) {
      throw new Error('Invalid class ID in receipt')
    }

    const classId = receipt.logs[0].address
    return { classId, txHash }
  }

  return { createNFTClass }
}
