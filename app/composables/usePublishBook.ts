import { getTransactionReceipt } from '@wagmi/vue/actions'
import { BookUploadStatus } from '~/types/bulk-upload'
import type {
  PublishBookInput,
  PublishFileRecord,
  PublishFileRecordWithBlob,
  PublishSession,
} from '~/types/publish'
import type { ISCNFormData } from '~/types/iscn'
import { NFT_DEFAULT_MINT_AMOUNT } from '~/constant'
import type { NFTTokenMetadata } from '~/composables/useNFTMinter'
import { buildIscnLinksFromFileRecords } from '~/utils/iscnLinks'
import { isRecordUploaded } from '~/utils/arweave'
import { mapPriceFormItemsToPayload } from '~/utils/listing'
import { isContentFingerprintEncrypted, validateISCNForm, createBookTokenMetadataBuilder } from '~/utils/iscn'

export interface PublishCallbacks {
  onStatusChange?: (status: BookUploadStatus, message?: string) => void
  onProgress?: (updates: Partial<PublishSession>) => void
  onError?: (error: string) => void
}

// Single-book commit pipeline: upload → NFT class → mint → listing, with
// per-step "already done?" guards so an interrupted publish resumes
// idempotently from its persisted checkpoints (classId, mintTxHash,
// per-record arweaveId). Shared with useBulkUpload's per-row processing.
export function usePublishBook() {
  const walletStore = useWalletStore()
  const bookstoreApiStore = useBookstoreApiStore()
  const nftStore = useNftStore()
  const { wallet } = storeToRefs(walletStore)
  const { validateWalletConsistency } = walletStore
  const { newBookListing, uploadSignImages } = bookstoreApiStore
  const { lazyFetchClassMetadataById } = nftStore
  const { uploadFileRecordsToArweave } = useArweaveUpload()
  const { createNFTClass, predictClassId } = useNFTClassCreator()
  const { checkNFTClassIsBookNFT, getNFTClassConfig } = useNFTContractReader()
  const { t: $t } = useI18n()
  const { mintNFT } = useNFTMinter()
  const { BOOK3_URL, LIKE_CO_API } = useRuntimeConfig().public
  const { $wagmiConfig } = useNuxtApp()

  const isProcessing = ref(false)

  // Returns true only for a confirmed-successful receipt and false for a
  // confirmed-reverted one. Receipt lookup throws while the tx is still pending
  // (TransactionReceiptNotFoundError) or on a transient RPC error — we let that
  // propagate so callers treat "unknown" as pending and keep the hash, rather
  // than clearing it and risking a duplicate re-mint.
  async function isMintTransactionConfirmed(txHash: string): Promise<boolean> {
    const receipt = await getTransactionReceipt($wagmiConfig, {
      hash: txHash as `0x${string}`,
    })
    return receipt?.status === 'success'
  }

  async function mintWithResume(params: {
    classId: string
    mintTxHash?: string
    buildTokenMetadata: (index: number, fromTokenId: bigint) => NFTTokenMetadata
    onMintTxHashChange?: (hash: string | undefined) => void
    mintCount?: number
  }): Promise<void> {
    const { classId, mintTxHash, buildTokenMetadata, onMintTxHashChange } = params

    // A prior attempt may have broadcast a mint whose confirmation we never
    // recorded; re-minting reuses the same fromTokenId and would revert against
    // the already-minted token, so verify any persisted hash before re-minting.
    if (mintTxHash) {
      if (await isMintTransactionConfirmed(mintTxHash)) {
        return
      }
      onMintTxHashChange?.(undefined)
    }

    // onSubmitted persists the hash as soon as the mint is broadcast, before the
    // confirmation wait — so an interruption there can't trigger a duplicate mint.
    await mintNFT({
      classId,
      mintCount: params.mintCount ?? NFT_DEFAULT_MINT_AMOUNT,
      buildTokenMetadata,
      onSubmitted: hash => onMintTxHashChange?.(hash),
    })
  }

  async function checkListingExists(classId: string): Promise<boolean> {
    const res = await fetch(`${LIKE_CO_API}/likernft/book/store/${classId}`)
    return res.ok
  }

  // Recovers a class a prior attempt deployed but never recorded the id for
  // (deterministic CREATE2 address). Adopts only on an exact metadata match so an
  // unrelated publish colliding on the same address isn't silently merged into.
  async function recoverDeployedClassId(iscnFormData: Ref<ISCNFormData>): Promise<string | undefined> {
    let predicted: `0x${string}` | undefined
    let intended: string | undefined
    let onChain: string | undefined
    try {
      const prediction = await predictClassId(iscnFormData)
      predicted = prediction.classId
      intended = prediction.metadata
      if (predicted && await checkNFTClassIsBookNFT(predicted)) {
        onChain = (await getNFTClassConfig(predicted)).metadata
      }
    }
    catch (error) {
      // Only transient recovery reads land here — fall back to a fresh deploy.
      // eslint-disable-next-line no-console
      console.warn('[publishBook] class-address recovery skipped:', error)
      return undefined
    }
    // Nothing deployed at the predicted address yet — create a fresh class.
    if (onChain === undefined) { return undefined }
    // A metadata mismatch means an unrelated publish collided on the
    // deterministic address; surface it rather than merge into that book.
    if (onChain !== intended) {
      throw new Error($t('errors.book_already_exists'))
    }
    return predicted!.toLowerCase()
  }

  function toPlainRecords(records: PublishFileRecordWithBlob[]): PublishFileRecord[] {
    return records.map(({ fileName, fileType, ipfsHash, fileSHA256, arweaveId, arweaveLink, arweaveKey }) => ({
      fileName, fileType, ipfsHash, fileSHA256, arweaveId, arweaveLink, arweaveKey,
    }))
  }

  function buildTokenMetadataFactory(iscnFormData: ISCNFormData, classId: string) {
    return createBookTokenMetadataBuilder({
      image: iscnFormData.coverUrl,
      title: iscnFormData.title,
      authorName: iscnFormData.author.name,
      publisherName: iscnFormData.publisher.name,
      classId,
      book3Url: BOOK3_URL as string,
    })
  }

  async function publishBook(
    input: PublishBookInput,
    callbacks: PublishCallbacks = {},
  ): Promise<{ classId: string } | false> {
    const { onStatusChange, onProgress, onError } = callbacks

    try {
      isProcessing.value = true

      await validateWalletConsistency()
      if (!wallet.value) {
        throw new Error('Wallet not connected')
      }

      const records = input.fileRecords
      // A pre-existing classId means a prior run already created the class —
      // a listing may exist too, so probe before POSTing (POST /new is not
      // idempotent server-side).
      // Also true once we recover/adopt an already-deployed class below, so the
      // listing step probes before POSTing either way.
      let classExistedBeforeRun = !!input.classId
      let classId = input.classId
      let mintTxHash = input.mintTxHash

      // Step 1: Upload files to Arweave or GCS-direct (resume guard)
      if (records.some(r => !isRecordUploaded(r))) {
        onStatusChange?.(BookUploadStatus.UPLOADING_FILES)
        await uploadFileRecordsToArweave(records, {
          encryptEbook: input.encryptEbook,
          sponsored: input.sponsored,
          onRecordUploaded: () => onProgress?.({ fileRecords: toPlainRecords(records) }),
        })
        onProgress?.({ fileRecords: toPlainRecords(records) })
      }

      // ISCN links derive from the uploaded records (the first downloadable URL
      // also seeds the class salt), so inject them only after uploads finish.
      // Recordless resumes (legacy deep links) keep the form's existing links.
      if (records.length) {
        const links = buildIscnLinksFromFileRecords(records)
        input.iscnFormData.contentFingerprints = links.contentFingerprints
        input.iscnFormData.downloadableUrls = links.downloadableUrls
        if (!input.iscnFormData.coverUrl) {
          input.iscnFormData.coverUrl = links.coverUrl
        }
      }

      // Step 2: Create NFT class
      if (!classId) {
        onStatusChange?.(BookUploadStatus.CREATING_NFT)
        const errors = validateISCNForm(input.iscnFormData)
        if (errors.length) {
          throw new Error(errors.join(', '))
        }
        // Adopt an already-deployed class (deterministic address) before minting
        // a new one — a redeploy reverts on the taken address, stranding the
        // publish. Falls back to creation when nothing is deployed yet.
        const iscnFormDataRef = ref(input.iscnFormData)
        classId = await recoverDeployedClassId(iscnFormDataRef)
        if (classId) {
          classExistedBeforeRun = true
        }
        else {
          const result = await createNFTClass({ iscnFormData: iscnFormDataRef })
          classId = result.classId
        }
        onProgress?.({ classId })
      }
      else {
        // Resumed with an externally supplied classId: make sure it actually
        // is an NFT book class before minting/listing against it.
        const data = await lazyFetchClassMetadataById(classId)
        const collectionId = String(data?.nft_meta_collection_id || '')
        if (!collectionId.includes('nft_book') && !collectionId.includes('book_nft')) {
          throw new Error('NOT_NFT_BOOK_COLLECTION')
        }
      }

      // Step 3: Mint NFTs (idempotent via persisted mintTxHash receipt check)
      if (!input.skipMint) {
        onStatusChange?.(BookUploadStatus.MINTING)
        await mintWithResume({
          classId,
          mintTxHash,
          buildTokenMetadata: buildTokenMetadataFactory(input.iscnFormData, classId),
          onMintTxHashChange: (hash) => {
            mintTxHash = hash
            onProgress?.({ mintTxHash: hash })
          },
        })
      }

      // Step 4: Create book listing
      onStatusChange?.(BookUploadStatus.LISTING)
      const alreadyListed = classExistedBeforeRun && await checkListingExists(classId)
      if (!alreadyListed) {
        const { listingDraft } = input
        const prices = mapPriceFormItemsToPayload(listingDraft.prices)
        const shouldEnableCustomMessagePage = prices.some(p => !p.isAutoDeliver || p.autoMemo)
        const hideDownload = input.encryptEbook
          || isContentFingerprintEncrypted(input.iscnFormData.contentFingerprints.map(f => f.url))
        await newBookListing(classId, {
          defaultPaymentCurrency: 'USD',
          connectedWallets: listingDraft.connectedWallets || null,
          moderatorWallets: listingDraft.moderatorWallets,
          prices,
          mustClaimToView: true,
          enableCustomMessagePage: shouldEnableCustomMessagePage,
          hideDownload,
          hideAudio: listingDraft.hideAudio,
          isAdultOnly: listingDraft.isAdultOnly,
          isPlusReadingEnabled: listingDraft.isPlusReadingEnabled,
          isPreviewEnabled: listingDraft.isPreviewEnabled,
          previewPercentage: listingDraft.previewPercentage,
          tableOfContents: listingDraft.tableOfContents || undefined,
          descriptionFull: listingDraft.descriptionFull?.trim() || undefined,
        })
      }

      if (input.signatureImage) {
        const form = new FormData()
        form.append('signImage', input.signatureImage)
        await uploadSignImages(form, classId)
      }

      onStatusChange?.(BookUploadStatus.COMPLETED)
      return { classId }
    }
    catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error'
      onError?.(errorMessage)
      onStatusChange?.(BookUploadStatus.FAILED, errorMessage)
      return false
    }
    finally {
      isProcessing.value = false
    }
  }

  return {
    isProcessing: readonly(isProcessing),
    publishBook,
    uploadFileRecordsToArweave,
    mintWithResume,
    isMintTransactionConfirmed,
  }
}
