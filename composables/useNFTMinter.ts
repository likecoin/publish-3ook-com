import { useWriteContract } from '@wagmi/vue'
import { LIKE_NFT_CLASS_ABI } from '~/contracts/likeNFT'

export interface NFTTokenMetadata {
  image: string
  external_url: string
  description: string
  name: string
  attributes?: Array<{ trait_type: string; value: string | number; display_type?: string }>
}

export function useNFTMinter () {
  const walletStore = useWalletStore()
  const { wallet } = storeToRefs(walletStore)
  const { checkAndGrantMinter, assertSufficientBalanceForTransaction, waitForTransactionReceipt } = useNFTContractWriter()
  const { getClassCurrentTokenId } = useNFTContractReader()
  const { writeContractAsync } = useWriteContract()

  async function mintNFT (params: {
    classId: string
    mintCount: number
    buildTokenMetadata: (index: number, fromTokenId: bigint) => NFTTokenMetadata
  }): Promise<{ txHash: string; fromTokenId: bigint }> {
    const { classId, mintCount, buildTokenMetadata } = params

    await checkAndGrantMinter({
      classId,
      wallet: wallet.value!
    })

    const fromTokenId = await getClassCurrentTokenId(classId) as bigint

    const nfts = [...Array(mintCount).keys()].map(i =>
      buildTokenMetadata(i, fromTokenId)
    )

    const txParams = {
      address: classId as `0x${string}`,
      abi: LIKE_NFT_CLASS_ABI,
      functionName: 'safeMintWithTokenId' as const,
      args: [
        fromTokenId,
        Array(mintCount).fill(wallet.value),
        Array(mintCount).fill(''),
        nfts.map(nft => JSON.stringify(nft))
      ]
    }

    await assertSufficientBalanceForTransaction({
      wallet: wallet.value!,
      ...txParams
    })

    const txHash = await writeContractAsync(txParams)
    const receipt = await waitForTransactionReceipt({ hash: txHash })

    if (!receipt || receipt.status !== 'success') {
      throw new Error('NFT minting failed')
    }

    return { txHash, fromTokenId }
  }

  return { mintNFT }
}
