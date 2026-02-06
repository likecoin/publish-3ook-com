import type { BulkUploadBook } from '~/utils/bulk-upload.type'
import { BookUploadStatus } from '~/utils/bulk-upload.type'
import { NFT_DEFAULT_MINT_AMOUNT } from '~/constant'
import { getApiEndpoints } from '~/constant/api'
import type { NFTTokenMetadata } from '~/composables/useNFTMinter'

interface ProcessingCallbacks {
  onStatusChange?: (bookId: string, status: BookUploadStatus, message?: string) => void
  onProgress?: (bookId: string, updates: Partial<BulkUploadBook>) => void
  onError?: (bookId: string, error: string) => void
}

export function useBulkUpload () {
  const walletStore = useWalletStore()
  const bookstoreApiStore = useBookstoreApiStore()
  const { wallet, signer } = storeToRefs(walletStore)
  const { validateWalletConsistency } = walletStore
  const { newBookListing } = bookstoreApiStore
  const { uploadToArweave } = useArweaveUpload()
  const { createNFTClass } = useNFTClassCreator()
  const { mintNFT } = useNFTMinter()
  const { BOOK3_URL } = useRuntimeConfig().public

  const isProcessing = ref(false)
  const currentBook = ref<BulkUploadBook | null>(null)
  const currentStep = ref('')

  async function processBook (
    book: BulkUploadBook,
    callbacks: ProcessingCallbacks = {}
  ): Promise<boolean> {
    const { onStatusChange, onError } = callbacks

    try {
      isProcessing.value = true
      currentBook.value = book

      // Ensure wallet is connected
      await validateWalletConsistency()
      if (!wallet.value || !signer.value) {
        throw new Error('Wallet not connected')
      }

      // Step 1: Upload files to Arweave
      if (!book.coverArweaveId || !book.bookArweaveId) {
        onStatusChange?.(book.id, BookUploadStatus.UPLOADING_FILES)
        await uploadFilesToArweave(book, callbacks)
      }

      // Step 2: Create NFT class (ISCN registration)
      if (!book.classId) {
        onStatusChange?.(book.id, BookUploadStatus.CREATING_NFT)
        await createNFTClassForBook(book, callbacks)
      }

      // Step 3: Mint NFT
      onStatusChange?.(book.id, BookUploadStatus.MINTING)
      await mintNFTForBook(book, callbacks)

      // Step 4: Create book listing
      onStatusChange?.(book.id, BookUploadStatus.LISTING)
      await createBookListing(book, callbacks)

      onStatusChange?.(book.id, BookUploadStatus.COMPLETED)
      return true
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error'
      onError?.(book.id, errorMessage)
      onStatusChange?.(book.id, BookUploadStatus.FAILED, errorMessage)
      return false
    } finally {
      isProcessing.value = false
      currentBook.value = null
      currentStep.value = ''
    }
  }

  async function uploadFilesToArweave (
    book: BulkUploadBook,
    callbacks: ProcessingCallbacks
  ): Promise<void> {
    const { onProgress } = callbacks

    // Upload cover image
    if (!book.coverArweaveId && book.coverFile) {
      currentStep.value = 'uploading_cover'
      const coverResult = await uploadToArweave({
        arrayBuffer: await book.coverFile.arrayBuffer(),
        fileSize: book.coverFile.size,
        fileType: book.coverFile.type,
        encrypt: false
      })
      book.coverArweaveId = coverResult.arweaveId
      book.coverIpfsHash = coverResult.ipfsHash
      onProgress?.(book.id, {
        coverArweaveId: coverResult.arweaveId,
        coverIpfsHash: coverResult.ipfsHash
      })
    }

    // Upload ebook file (prefer EPUB, fall back to PDF)
    if (!book.bookArweaveId) {
      const ebookFile = book.epubFile || book.pdfFile
      if (!ebookFile) {
        throw new Error('No ebook file found')
      }

      currentStep.value = 'uploading_ebook'
      const bookResult = await uploadToArweave({
        arrayBuffer: await ebookFile.arrayBuffer(),
        fileSize: ebookFile.size,
        fileType: ebookFile.type,
        encrypt: book.enableDRM
      })
      book.bookArweaveId = bookResult.arweaveId
      book.bookArweaveKey = bookResult.arweaveKey
      book.bookIpfsHash = bookResult.ipfsHash
      onProgress?.(book.id, {
        bookArweaveId: bookResult.arweaveId,
        bookArweaveKey: bookResult.arweaveKey,
        bookIpfsHash: bookResult.ipfsHash
      })
    }
  }

  async function createNFTClassForBook (
    book: BulkUploadBook,
    callbacks: ProcessingCallbacks
  ): Promise<void> {
    const { onProgress } = callbacks
    currentStep.value = 'creating_nft_class'

    const apiEndpoints = getApiEndpoints()

    const ebookFile = book.epubFile || book.pdfFile
    const fileType = book.epubFile ? 'epub' : 'pdf'
    const arweaveLink = book.bookArweaveKey
      ? `${apiEndpoints.API_GET_ARWEAVE_V2_LINK}/${book.bookArweaveId}?key=${book.bookArweaveKey}`
      : `ar://${book.bookArweaveId}`

    const contentFingerprints = [
      { url: `ar://${book.coverArweaveId}` },
      { url: arweaveLink }
    ]

    const iscnFormData = ref({
      type: 'Book',
      title: book.title,
      description: book.description,
      alternativeHeadline: '',
      isbn: book.isbn || '',
      publisher: book.publisher,
      publicationDate: book.publishDate || '',
      author: {
        name: book.authorName,
        description: book.authorDescription || ''
      },
      license: 'All Rights Reserved',
      customLicense: '',
      contentFingerprints,
      downloadableUrls: [{
        url: arweaveLink,
        type: fileType,
        fileName: ebookFile?.name || `${book.title}.${fileType}`
      }],
      language: book.language,
      bookInfoUrl: '',
      tags: book.tags,
      coverUrl: `ar://${book.coverArweaveId}`,
      genre: ''
    })

    const { classId } = await createNFTClass({ iscnFormData })
    book.classId = classId
    onProgress?.(book.id, { classId })
  }

  async function mintNFTForBook (
    book: BulkUploadBook,
    callbacks: ProcessingCallbacks
  ): Promise<void> {
    const { onProgress } = callbacks
    currentStep.value = 'minting_nft'

    if (!book.classId) {
      throw new Error('Class ID not found')
    }

    const mintCount = NFT_DEFAULT_MINT_AMOUNT

    const buildTokenMetadata = (index: number, fromTokenId: bigint): NFTTokenMetadata => ({
      image: `ar://${book.coverArweaveId}`,
      external_url: `${BOOK3_URL}/store/${book.classId}/${Number(fromTokenId) + index}`,
      description: `Copy #${Number(fromTokenId) + index} of ${book.title}`,
      name: `${book.title} #${Number(fromTokenId) + index}`,
      attributes: [
        { trait_type: 'Author', value: book.authorName },
        { trait_type: 'Publisher', value: book.publisher }
      ]
    })

    const { txHash } = await mintNFT({
      classId: book.classId,
      mintCount,
      buildTokenMetadata
    })

    book.mintTxHash = txHash
    onProgress?.(book.id, { mintTxHash: txHash })
  }

  async function createBookListing (
    book: BulkUploadBook,
    _callbacks: ProcessingCallbacks
  ): Promise<void> {
    currentStep.value = 'creating_listing'

    if (!book.classId) {
      throw new Error('Class ID not found')
    }

    const price = {
      name: {
        en: book.editionName,
        zh: book.editionName
      },
      description: {
        en: book.editionDescription,
        zh: book.editionDescription
      },
      priceInDecimal: Math.round(book.listPrice * 100),
      price: book.listPrice,
      stock: 0,
      isAutoDeliver: book.isAutoDeliver,
      isAllowCustomPrice: true,
      isUnlisted: false,
      autoMemo: book.autoMemo
    }

    await newBookListing(book.classId, {
      defaultPaymentCurrency: 'USD',
      connectedWallets: null,
      moderatorWallets: ['0xa037Feb6508A8C2F93bb19f6721730C45921f2D0'],
      prices: [price],
      mustClaimToView: true,
      enableCustomMessagePage: !!book.autoMemo,
      hideDownload: book.enableDRM
    })
  }

  async function processBooksSequentially (
    books: BulkUploadBook[],
    callbacks: ProcessingCallbacks & {
      onBookComplete?: (book: BulkUploadBook, success: boolean) => void
      shouldContinue?: () => boolean
    }
  ): Promise<{ completed: number; failed: number }> {
    let completed = 0
    let failed = 0

    for (const book of books) {
      // Check if we should continue
      if (callbacks.shouldContinue && !callbacks.shouldContinue()) {
        break
      }

      // Skip already completed books
      if (book.status === BookUploadStatus.COMPLETED) {
        completed++
        continue
      }

      const success = await processBook(book, callbacks)

      if (success) {
        completed++
      } else {
        failed++
      }

      callbacks.onBookComplete?.(book, success)

      // Small delay between books to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    return { completed, failed }
  }

  return {
    isProcessing: readonly(isProcessing),
    currentBook: readonly(currentBook),
    currentStep: readonly(currentStep),
    processBook,
    processBooksSequentially
  }
}
