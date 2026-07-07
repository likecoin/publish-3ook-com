import { LIKE_NFT_CLASS_ABI } from '~/contracts/likeNFT'
import { DEFAULT_MAX_SUPPLY } from '~/constant'
import type { ClassMetadata, ISCNFormData, ISCNRegisterPayload } from '~/types/iscn'
import { formatISCNTxPayload } from '~/utils/iscn'
import { getFileTypeFromMime } from '~/composables/useISCN'

// Loads on-chain class metadata into the shared ISCNForm shape and saves
// edits back via the class `update` tx. Shared by the status page's unified
// edit mode and the wizard's legacy-link resume.
export function useNFTClassUpdater() {
  const nftStore = useNftStore()
  const walletStore = useWalletStore()
  const { wallet } = storeToRefs(walletStore)
  const { validateWalletConsistency } = walletStore
  const { writeContractAsync } = useContractWrite()
  const {
    checkAndGrantUpdater,
    assertSufficientBalanceForTransaction,
    waitForTransactionReceipt,
  } = useNFTContractWriter()
  const { getNFTClassConfig } = useNFTContractReader()
  const { refreshBookMetadata } = useBookstoreApiStore()

  function parseDownloadableUrl(url: string) {
    try {
      const urlObj = new URL(url)
      const rawName = urlObj.searchParams.get('name') || ''
      const lastDot = rawName.lastIndexOf('.')
      const name = lastDot > 0 ? rawName.slice(0, lastDot) : rawName
      const type = lastDot > 0 ? rawName.slice(lastDot + 1) : ''
      return {
        url: url.split('?')[0] || '',
        fileName: name,
        type,
      }
    }
    catch {
      return {
        url,
        fileName: '',
        type: '',
      }
    }
  }

  function mapClassMetadataToISCNForm(metadata: ClassMetadata): ISCNFormData {
    // Parse potentialAction targets (or legacy sameAs URLs) into downloadableUrls
    let downloadableUrls = [{
      url: '',
      type: '',
      fileName: '',
    }]
    if (metadata.potentialAction?.target && Array.isArray(metadata.potentialAction.target)) {
      downloadableUrls = metadata.potentialAction.target.map((target: { contentType: string, url?: string, name?: string }) => ({
        type: getFileTypeFromMime(target.contentType),
        url: target.url || '',
        fileName: target.name || '',
      }))
    }
    else if (metadata.sameAs && Array.isArray(metadata.sameAs)) {
      downloadableUrls = metadata.sameAs.map(parseDownloadableUrl)
    }
    const tags: string[] = []
    if (metadata.keywords) {
      if (Array.isArray(metadata.keywords)) {
        tags.push(...metadata.keywords)
      }
      else {
        tags.push(...metadata.keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k))
      }
    }
    return {
      ...metadata,
      type: metadata['@type'] || 'Book',
      title: metadata.name || '',
      description: metadata.description || '',
      descriptionFull: metadata.descriptionFull || '',
      alternativeHeadline: metadata.alternativeHeadline || '',
      isbn: metadata.isbn || '',
      publisher: {
        name: (typeof metadata.publisher === 'object' ? metadata.publisher?.name : metadata.publisher) || '',
        description: (typeof metadata.publisher === 'object' ? metadata.publisher?.description : '') || '',
      },
      publicationDate: metadata.datePublished || '',
      author: {
        name: (typeof metadata.author === 'object' ? metadata.author?.name : metadata.author) || '',
        description: (typeof metadata.author === 'object' ? metadata.author?.description : '') || '',
      },
      license: metadata.usageInfo || 'All Rights Reserved',
      contentFingerprints: metadata.contentFingerprints?.map((url: string) => ({
        url,
      })) || [{ url: '' }],
      downloadableUrls,
      customLicense: '',
      language: metadata.inLanguage || '',
      bookInfoUrl: metadata.url || '',
      tags,
      coverUrl: metadata.thumbnailUrl || metadata.image || '',
      genre: metadata.genre || '',
    }
  }

  async function loadClassMetadataIntoForm(
    classId: string,
  ): Promise<{ formData: ISCNFormData, chainData: ClassMetadata } | null> {
    const metadata = await nftStore.lazyFetchClassMetadataById(classId)
    if (!metadata) { return null }
    return {
      formData: mapClassMetadataToISCNForm(metadata),
      chainData: metadata,
    }
  }

  // Signs the class `update` tx and refreshes cached/backend metadata.
  // Throws on any failure; callers surface the error to the user.
  async function saveClassMetadata(
    classId: string,
    registerPayload: ISCNRegisterPayload,
  ): Promise<{ metadata: Record<string, unknown> & { name: string, description: string, symbol: string } }> {
    await validateWalletConsistency()
    if (!wallet.value) {
      throw new Error('WALLET_NOT_INITED')
    }

    const contentMetadata = formatISCNTxPayload(registerPayload)
    const metadata = {
      ...contentMetadata,
      symbol: 'BOOK',
      external_link: contentMetadata?.url || '',
      image: contentMetadata?.thumbnailUrl || '',
      nft_meta_collection_id: 'nft_book',
      nft_meta_collection_name: 'NFT Book',
      nft_meta_collection_description: 'NFT Book by Liker Land',
      recordTimestamp: new Date().toISOString(),
    }
    const bookConfig = await getNFTClassConfig(classId)
    await checkAndGrantUpdater({
      classId,
      wallet: wallet.value,
    })

    const txParams = {
      address: classId as `0x${string}`,
      abi: LIKE_NFT_CLASS_ABI,
      functionName: 'update',
      args: [{
        name: metadata.name,
        symbol: bookConfig.symbol,
        metadata: JSON.stringify(metadata),
        max_supply: DEFAULT_MAX_SUPPLY,
      }],
    }

    await assertSufficientBalanceForTransaction({
      wallet: wallet.value,
      ...txParams,
    })

    const txHash = await writeContractAsync(txParams)
    const receipt = await waitForTransactionReceipt({ hash: txHash })
    if (!receipt || receipt.status !== 'success') { throw new Error('INVALID_RECEIPT') }
    await nftStore.fetchClassMetadataById(classId)
    await refreshBookMetadata(classId)
    return { metadata }
  }

  return {
    mapClassMetadataToISCNForm,
    loadClassMetadataIntoForm,
    saveClassMetadata,
  }
}
