import { parse as csvParse } from 'csv-parse/sync'
import type { BulkUploadBook, BulkUploadCSVRow, BulkUploadValidationError } from '~/types/bulk-upload'
import { BookUploadStatus } from '~/types/bulk-upload'
import {
  parseCSVRow,
  validateBook,
  validateBooks,
  validateProgressFieldFormats,
  CSV_REQUIRED_COLUMNS,
  CSV_OPTIONAL_COLUMNS_WITH_DEFAULTS,
} from '~/utils/bulk-upload'
import { loadBulkUploadSession, restoreBooksFromSession } from '~/utils/bulkUploadSession'

// Owns the bulk-upload wizard's step machine: CSV parsing/validation with
// on-chain progress verification, file-to-book matching, derived progress
// lists, and session resume. Processing orchestration stays with the page.
export function useBulkUploadWizard() {
  const { t: $t } = useI18n()
  const { showSuccessToast, showErrorToast } = useToastComposable()
  const { getClassMetadata } = useNFTContractReader()
  const { isMintTransactionConfirmed } = usePublishBook()

  const currentStep = ref<'csv' | 'files' | 'review' | 'processing'>('csv')
  const isVerifyingProgress = ref(false)
  const books = ref<BulkUploadBook[]>([])
  const validationErrors = ref<BulkUploadValidationError[]>([])
  const csvError = ref('')
  const missingOptionalColumns = ref<{ column: string, defaultValue: string }[]>([])
  const selectedFiles = ref<File[]>([])
  const hasExistingSession = ref(false)

  onMounted(() => {
    hasExistingSession.value = loadBulkUploadSession() !== null
  })

  const pendingBooks = computed(() =>
    books.value.filter(b => b.status === BookUploadStatus.PENDING),
  )

  const completedBooks = computed(() =>
    books.value.filter(b => b.status === BookUploadStatus.COMPLETED),
  )

  const failedBooks = computed(() =>
    books.value.filter(b => b.status === BookUploadStatus.FAILED),
  )

  const unmatchedBooks = computed(() =>
    books.value.filter((b) => {
      if (b.status === BookUploadStatus.COMPLETED) { return false }
      if (b.coverArweaveId && b.bookArweaveId) { return false }
      return !b.coverFile || (!b.pdfFile && !b.epubFile)
    }),
  )

  const expectedFilenameSet = computed(() => {
    const set = new Set<string>()
    books.value.forEach((book) => {
      if (book.coverImageFilename) { set.add(book.coverImageFilename.toLowerCase()) }
      if (book.pdfFilename) { set.add(book.pdfFilename.toLowerCase()) }
      if (book.epubFilename) { set.add(book.epubFilename.toLowerCase()) }
    })
    return set
  })

  const extraFiles = computed(() =>
    selectedFiles.value.filter(f => !expectedFilenameSet.value.has(f.name.toLowerCase())),
  )

  const fileMatchingStatus = computed(() =>
    books.value.map(book => ({
      title: book.title,
      hasCover: !!book.coverFile,
      coverFilename: book.coverImageFilename,
      hasPdf: !!book.pdfFile,
      pdfFilename: book.pdfFilename || '',
      hasEpub: !!book.epubFile,
      epubFilename: book.epubFilename || '',
    })),
  )

  function handleCSVFileUpload(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) { return }

    validationErrors.value = []
    csvError.value = ''

    const reader = new FileReader()
    reader.onload = (e) => {
      const csvContent = e.target?.result as string
      parseCSV(csvContent)
    }
    reader.readAsText(file)
  }

  async function parseCSV(csvContent: string) {
    validationErrors.value = []
    csvError.value = ''

    try {
      const records = csvParse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[]

      if (records.length === 0) {
        csvError.value = $t('bulk_upload.no_records')
        return
      }

      // Validate headers
      const headers = Object.keys(records[0]!)
      const missingRequired = CSV_REQUIRED_COLUMNS.filter(col => !headers.includes(col))
      if (missingRequired.length > 0) {
        csvError.value = $t('bulk_upload.invalid_headers', { columns: missingRequired.join(', ') })
        return
      }

      missingOptionalColumns.value = Object.entries(CSV_OPTIONAL_COLUMNS_WITH_DEFAULTS)
        .filter(([col]) => !headers.includes(col))
        .map(([column, defaultValue]) => ({ column, defaultValue }))

      const hasProgressColumns = headers.includes('status') || headers.includes('class_id')
      const parsedBooks: BulkUploadBook[] = []
      const allErrors: BulkUploadValidationError[] = []

      records.forEach((row: any, index: number) => {
        const book = parseCSVRow(row, index + 1)
        const errors = validateBook(book, row as BulkUploadCSVRow)

        if (errors.length > 0) {
          allErrors.push(...errors)
        }

        if (hasProgressColumns) {
          const csvRow = row as BulkUploadCSVRow
          const progress = validateProgressFieldFormats(csvRow)
          Object.assign(book, progress)

          if (csvRow.status === BookUploadStatus.COMPLETED && progress.classId) {
            book.status = BookUploadStatus.COMPLETED
          }
        }

        parsedBooks.push(book)
      })

      allErrors.push(...validateBooks(parsedBooks))

      if (allErrors.length > 0) {
        validationErrors.value = allErrors
        return
      }

      if (hasProgressColumns) {
        isVerifyingProgress.value = true
        try {
          await verifyProgressFieldsOnChain(parsedBooks)
        }
        finally {
          isVerifyingProgress.value = false
        }
      }

      books.value = parsedBooks
      currentStep.value = 'files'

      showSuccessToast($t('bulk_upload.csv_parsed_success', { count: parsedBooks.length }))
    }
    catch (error: any) {
      showErrorToast($t('bulk_upload.csv_parse_error'), { description: error.message })
    }
  }

  async function verifyProgressFieldsOnChain(booksToVerify: BulkUploadBook[]) {
    for (const book of booksToVerify) {
      if (book.classId) {
        try {
          await getClassMetadata(book.classId)
        }
        catch {
          book.classId = undefined
          book.mintTxHash = undefined
          if (book.status === BookUploadStatus.COMPLETED) {
            book.status = BookUploadStatus.PENDING
          }
        }
      }

      if (book.mintTxHash) {
        try {
          if (!(await isMintTransactionConfirmed(book.mintTxHash))) {
            book.mintTxHash = undefined
          }
        }
        catch {
          // Receipt not available yet (pending tx / transient RPC issue) — keep
          // the hash so resume verification can't trigger a duplicate mint.
        }
      }
    }
  }

  function handleFilesChange(event: Event) {
    const target = event.target as HTMLInputElement
    const files = Array.from(target.files || [])
    selectedFiles.value = files

    // Clear all previous file matches
    books.value.forEach((book) => {
      book.coverFile = undefined
      book.pdfFile = undefined
      book.epubFile = undefined
    })

    // Match files to books
    const fileMap = new Map<string, File>()
    files.forEach((file) => {
      fileMap.set(file.name.toLowerCase(), file)
    })

    books.value.forEach((book) => {
      // Match cover image
      const coverFile = fileMap.get(book.coverImageFilename.toLowerCase())
      if (coverFile) {
        book.coverFile = coverFile
      }

      // Match PDF
      if (book.pdfFilename) {
        const pdfFile = fileMap.get(book.pdfFilename.toLowerCase())
        if (pdfFile) {
          book.pdfFile = pdfFile
        }
      }

      // Match EPUB
      if (book.epubFilename) {
        const epubFile = fileMap.get(book.epubFilename.toLowerCase())
        if (epubFile) {
          book.epubFile = epubFile
        }
      }
    })
  }

  function resumeSession() {
    const session = loadBulkUploadSession()
    if (!session) { return }

    hasExistingSession.value = false
    books.value = restoreBooksFromSession(session)

    // If all books have their Arweave uploads done, go straight to processing
    const needsFiles = books.value.some((b) => {
      if (b.coverArweaveId && b.bookArweaveId) { return false }
      return !b.coverFile || (!b.pdfFile && !b.epubFile)
    })

    if (needsFiles) {
      currentStep.value = 'files'
    }
    else {
      currentStep.value = 'processing'
    }
  }

  function resetWizard() {
    books.value = []
    validationErrors.value = []
    csvError.value = ''
    missingOptionalColumns.value = []
    selectedFiles.value = []
    currentStep.value = 'csv'
  }

  return {
    currentStep,
    isVerifyingProgress,
    books,
    validationErrors,
    csvError,
    missingOptionalColumns,
    selectedFiles,
    hasExistingSession,
    pendingBooks,
    completedBooks,
    failedBooks,
    unmatchedBooks,
    extraFiles,
    fileMatchingStatus,
    handleCSVFileUpload,
    handleFilesChange,
    resumeSession,
    resetWizard,
  }
}
