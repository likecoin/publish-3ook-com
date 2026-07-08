import type { BulkUploadBook } from '~/types/bulk-upload'
import { BookUploadStatus } from '~/types/bulk-upload'
import type { BookPriceInDecimalByCurrency } from '~/types'
import type { PublishFileRecordWithBlob } from '~/types/publish'
import { createBookTokenMetadataBuilder } from '~/utils/iscn'
import { detectEbookType } from '~/utils/ebookType'
import { buildIscnLinksFromFileRecords } from '~/utils/iscnLinks'

interface ProcessingCallbacks {
  onStatusChange?: (bookId: string, status: BookUploadStatus, message?: string) => void
  onProgress?: (bookId: string, updates: Partial<BulkUploadBook>) => void
  onError?: (bookId: string, error: string) => void
  sponsored?: boolean
}

export function useBulkUpload() {
  const walletStore = useWalletStore()
  const bookstoreApiStore = useBookstoreApiStore()
  const { wallet } = storeToRefs(walletStore)
  const { validateWalletConsistency } = walletStore
  const { newBookListing } = bookstoreApiStore
  const { createNFTClass } = useNFTClassCreator()
  const {
    uploadFileRecordsToArweave,
    mintWithResume,
    isMintTransactionConfirmed,
  } = usePublishBook()
  const { BOOK3_URL } = useRuntimeConfig().public

  const isProcessing = ref(false)
  const currentBook = ref<BulkUploadBook | null>(null)
  const currentStep = ref('')

  async function processBook(
    book: BulkUploadBook,
    callbacks: ProcessingCallbacks = {},
  ): Promise<boolean> {
    const { onStatusChange, onError } = callbacks

    try {
      isProcessing.value = true
      currentBook.value = book

      // Ensure wallet is connected
      await validateWalletConsistency()
      if (!wallet.value) {
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

      // Step 3: Mint NFT (mintNFTForBook is idempotent — see its receipt check)
      onStatusChange?.(book.id, BookUploadStatus.MINTING)
      await mintNFTForBook(book, callbacks)

      // Step 4: Create book listing
      onStatusChange?.(book.id, BookUploadStatus.LISTING)
      await createBookListing(book, callbacks)

      onStatusChange?.(book.id, BookUploadStatus.COMPLETED)
      useLogEvent('bulk_upload_book_completed', { book_id: book.id, class_id: book.classId })
      return true
    }
    catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error'
      useLogEvent('bulk_upload_book_failed', { book_id: book.id, error: errorMessage })
      onError?.(book.id, errorMessage)
      onStatusChange?.(book.id, BookUploadStatus.FAILED, errorMessage)
      return false
    }
    finally {
      isProcessing.value = false
      currentBook.value = null
      currentStep.value = ''
    }
  }

  // Adapter: maps the CSV-row book fields to shared upload records and back,
  // preserving the per-field resume model of the result CSV.
  async function uploadFilesToArweave(
    book: BulkUploadBook,
    callbacks: ProcessingCallbacks,
  ): Promise<void> {
    const { onProgress, sponsored } = callbacks
    const records: PublishFileRecordWithBlob[] = []

    if (!book.coverArweaveId) {
      if (!book.coverFile) {
        throw new Error('No cover image file found')
      }
      records.push({
        fileName: book.coverFile.name,
        fileType: book.coverFile.type,
        fileBlob: book.coverFile,
      })
    }

    if (!book.bookArweaveId) {
      const ebookFile = book.epubFile || book.pdfFile
      if (!ebookFile) {
        throw new Error('No ebook file found')
      }
      const ebookBuffer = await ebookFile.arrayBuffer()
      const detectedType = detectEbookType(ebookBuffer)
      if (!detectedType) {
        throw new Error(`File ${ebookFile.name} is not a valid PDF or EPUB`)
      }
      book.detectedFileType = detectedType
      onProgress?.(book.id, { detectedFileType: detectedType })
      records.push({
        fileName: ebookFile.name,
        fileType: detectedType === 'epub' ? 'application/epub+zip' : 'application/pdf',
        fileBlob: ebookFile,
        fileSHA256: await digestFileSHA256(ebookBuffer),
      })
    }

    await uploadFileRecordsToArweave(records, {
      encryptEbook: book.enableDRM,
      sponsored,
      onRecordPrepare: (record) => {
        currentStep.value = record.fileType.startsWith('image/')
          ? 'uploading_cover'
          : 'uploading_ebook'
      },
      onRecordUploaded: (record) => {
        if (record.fileType.startsWith('image/')) {
          book.coverArweaveId = record.arweaveId
          book.coverIpfsHash = record.ipfsHash
          onProgress?.(book.id, {
            coverArweaveId: record.arweaveId,
            coverIpfsHash: record.ipfsHash,
          })
        }
        else {
          book.bookArweaveId = record.arweaveId
          book.bookArweaveKey = record.arweaveKey
          book.bookArweaveLink = record.arweaveLink
          book.bookIpfsHash = record.ipfsHash
          book.bookFileSHA256 = record.fileSHA256
          onProgress?.(book.id, {
            bookArweaveId: record.arweaveId,
            bookArweaveKey: record.arweaveKey,
            bookArweaveLink: record.arweaveLink,
            bookIpfsHash: record.ipfsHash,
            bookFileSHA256: record.fileSHA256,
          })
        }
      },
    })
  }

  async function createNFTClassForBook(
    book: BulkUploadBook,
    callbacks: ProcessingCallbacks,
  ): Promise<void> {
    const { onProgress } = callbacks
    currentStep.value = 'creating_nft_class'

    const ebookFile = book.epubFile || book.pdfFile
    const fileType = book.detectedFileType ?? (book.epubFilename ? 'epub' : 'pdf')

    const { downloadableUrls, contentFingerprints, coverUrl } = buildIscnLinksFromFileRecords([
      {
        fileName: book.coverImageFilename,
        fileType: 'image/jpeg',
        arweaveId: book.coverArweaveId,
      },
      {
        fileName: ebookFile?.name || book.epubFilename || book.pdfFilename || `${book.title}.${fileType}`,
        fileType: fileType === 'epub' ? 'application/epub+zip' : 'application/pdf',
        arweaveId: book.bookArweaveId,
        arweaveLink: book.bookArweaveLink,
        arweaveKey: book.bookArweaveKey,
      },
    ])

    const iscnFormData = ref({
      type: 'Book',
      title: book.title,
      description: book.description,
      alternativeHeadline: '',
      isbn: book.isbn || '',
      publisher: {
        name: book.publisher,
        description: book.publisherDescription || '',
      },
      publicationDate: book.publishDate || '',
      author: {
        name: book.authorName,
        description: book.authorDescription || '',
      },
      license: 'All Rights Reserved',
      customLicense: '',
      contentFingerprints,
      downloadableUrls,
      language: book.language,
      bookInfoUrl: '',
      tags: book.tags,
      coverUrl,
      genre: '',
    })

    const { classId } = await createNFTClass({ iscnFormData })
    book.classId = classId
    onProgress?.(book.id, { classId })
  }

  async function mintNFTForBook(
    book: BulkUploadBook,
    callbacks: ProcessingCallbacks,
  ): Promise<void> {
    const { onProgress } = callbacks
    currentStep.value = 'minting_nft'

    if (!book.classId) {
      throw new Error('Class ID not found')
    }

    const buildTokenMetadata = createBookTokenMetadataBuilder({
      image: `ar://${book.coverArweaveId}`,
      title: book.title,
      authorName: book.authorName,
      publisherName: book.publisher,
      classId: book.classId,
      book3Url: BOOK3_URL as string,
    })

    await mintWithResume({
      classId: book.classId,
      mintTxHash: book.mintTxHash,
      buildTokenMetadata,
      onMintTxHashChange: (hash) => {
        book.mintTxHash = hash
        onProgress?.(book.id, { mintTxHash: hash })
      },
    })
  }

  async function createBookListing(
    book: BulkUploadBook,
    _callbacks: ProcessingCallbacks,
  ): Promise<void> {
    currentStep.value = 'creating_listing'

    if (!book.classId) {
      throw new Error('Class ID not found')
    }

    const priceInDecimalByCurrency: BookPriceInDecimalByCurrency = {}
    if (typeof book.listPriceHKD === 'number') {
      priceInDecimalByCurrency.hkd = Math.round(book.listPriceHKD * 100)
    }
    if (typeof book.listPriceTWD === 'number') {
      priceInDecimalByCurrency.twd = Math.round(book.listPriceTWD * 100)
    }
    const price = {
      name: {
        en: book.editionName,
        zh: book.editionName,
      },
      description: {
        en: book.editionDescription,
        zh: book.editionDescription,
      },
      priceInDecimal: Math.round(book.listPrice * 100),
      price: book.listPrice,
      stock: 0,
      isAutoDeliver: book.isAutoDeliver,
      isAllowCustomPrice: true,
      isUnlisted: false,
      autoMemo: book.autoMemo,
      ...(Object.keys(priceInDecimalByCurrency).length > 0 ? { priceInDecimalByCurrency } : {}),
    }

    await newBookListing(book.classId, {
      defaultPaymentCurrency: 'USD',
      connectedWallets: null,
      moderatorWallets: ['0xa037Feb6508A8C2F93bb19f6721730C45921f2D0'],
      prices: [price],
      mustClaimToView: true,
      enableCustomMessagePage: !!book.autoMemo,
      hideDownload: book.enableDRM,
      hideAudio: !book.enableTTS,
      isPlusReadingEnabled: book.isPlusReadingEnabled,
      descriptionFull: book.descriptionFull?.trim() || undefined,
    })
  }

  async function processBooksSequentially(
    books: BulkUploadBook[],
    callbacks: ProcessingCallbacks & {
      onBookComplete?: (book: BulkUploadBook, success: boolean) => void
      shouldContinue?: () => boolean
    },
  ): Promise<{ completed: number, failed: number }> {
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
      }
      else {
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
    processBooksSequentially,
    isMintTransactionConfirmed,
  }
}
