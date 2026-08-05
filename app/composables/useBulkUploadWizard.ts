import { parse as csvParse } from 'csv-parse/sync'
import type { BulkUploadBook, BulkUploadCSVRow, BulkUploadValidationError } from '~/types/bulk-upload'
import { BookUploadStatus } from '~/types/bulk-upload'
import {
  parseCSVRow,
  validateBook,
  validateBooks,
  validateProgressFieldFormats,
  normalizeFilename,
  hasArweaveUploads,
  CSV_REQUIRED_COLUMNS,
  CSV_OPTIONAL_COLUMNS_WITH_DEFAULTS,
} from '~/utils/bulk-upload'
import { loadBulkUploadSession, restoreBooksFromSession } from '~/utils/bulkUploadSession'
import type { DraftFileRequest } from '~/utils/draftFiles'
import { UPLOADABLE_FILE_TYPES } from '~/constant'

// The three file slots a book can carry. Named once so persisting, restoring
// and matching walk the same list rather than spelling it out three ways.
const BOOK_FILE_SLOTS = [
  { filename: 'coverImageFilename', file: 'coverFile' },
  { filename: 'pdfFilename', file: 'pdfFile' },
  { filename: 'epubFilename', file: 'epubFile' },
] as const

// Files are stored under their CSV filename, which is the identity this flow
// already trusts: matching and duplicate detection both run on it. The wizard
// keys by content hash because it has one for upload; hashing a hundred 200MB
// files here would cost a pass over every byte to learn nothing new.

// A draft is three files; a batch can be hundreds. Past this, nothing is
// persisted and the re-select prompt covers the batch — the same place every
// other storage failure lands.
const MAX_PERSISTED_BATCH_BYTES = 2 * 1024 * 1024 * 1024

// Bounds a single transaction: a quota failure then costs one chunk rather
// than the whole batch.
const PERSIST_CHUNK_SIZE = 20

// Leaves the origin room for the session JSON and anything else it stores,
// rather than filling the quota to the brim with book files.
const STORAGE_HEADROOM_BYTES = 512 * 1024 * 1024

async function getPersistBudget(): Promise<number> {
  try {
    const estimate = await navigator.storage?.estimate?.()
    if (!estimate?.quota) { return MAX_PERSISTED_BATCH_BYTES }
    const free = estimate.quota - (estimate.usage || 0) - STORAGE_HEADROOM_BYTES
    return Math.max(0, Math.min(MAX_PERSISTED_BATCH_BYTES, free))
  }
  catch {
    return MAX_PERSISTED_BATCH_BYTES
  }
}

// Structured clone preserves File, so this usually hands back what went in;
// the reconstruction is for engines that return a plain Blob.
function toFile(blob: Blob, filename: string): File {
  return blob instanceof File ? blob : new File([blob], filename, { type: blob.type })
}

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
  const isResuming = ref(false)

  onMounted(() => {
    hasExistingSession.value = loadBulkUploadSession() !== null
    // The session lives in sessionStorage and dies with the tab; these files do
    // not. Without this sweep a closed tab strands its batch's bytes on disk
    // with nothing left that could ever ask for them. A second tab sweeps the
    // first tab's files too, which costs that batch its resume but not its run.
    if (!hasExistingSession.value) { bulkUploadFileStore.clearDraftFiles() }
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
      if (hasArweaveUploads(b)) { return false }
      return !b.coverFile || (!b.pdfFile && !b.epubFile)
    }),
  )

  const expectedFilenameSet = computed(() => {
    const set = new Set<string>()
    books.value.forEach((book) => {
      BOOK_FILE_SLOTS.forEach((slot) => {
        const key = normalizeFilename(book[slot.filename])
        if (key) { set.add(key) }
      })
    })
    return set
  })

  const extraFiles = computed(() =>
    selectedFiles.value.filter(f => !expectedFilenameSet.value.has(normalizeFilename(f.name))),
  )

  // Files whose type has no storage tier. Kept out of selectedFiles entirely so
  // they can never match a CSV row and fail mid-batch; surfaced separately from
  // extraFiles because "wrong format" needs a different fix than "not in the CSV".
  const unsupportedFiles = ref<File[]>([])

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
    const files: File[] = []
    const unsupported: File[] = []
    for (const file of Array.from(target.files || [])) {
      (UPLOADABLE_FILE_TYPES.includes(file.type) ? files : unsupported).push(file)
    }
    unsupportedFiles.value = unsupported
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
      fileMap.set(normalizeFilename(file.name), file)
    })

    books.value.forEach((book) => {
      BOOK_FILE_SLOTS.forEach((slot) => {
        const match = fileMap.get(normalizeFilename(book[slot.filename]))
        if (match) { book[slot.file] = match }
      })
    })

    persistMatchedFiles()
  }

  // Each pick replaces the batch's files wholesale, matching the match-clearing
  // above, so the store is emptied rather than reconciled. Runs are chained
  // because their writes and clears are on separate connections and cannot be
  // ordered against each other; runId then drops a superseded run's work.
  let persistRunId = 0
  let persistChain: Promise<void> = Promise.resolve()

  function persistMatchedFiles() {
    const runId = ++persistRunId
    persistChain = persistChain.then(() => writeMatchedFiles(runId))
  }

  async function writeMatchedFiles(runId: number): Promise<void> {
    await bulkUploadFileStore.clearDraftFiles()
    if (runId !== persistRunId) { return }

    const entries: [string, Blob][] = []
    let total = 0
    for (const book of books.value) {
      if (hasArweaveUploads(book)) { continue }
      for (const slot of BOOK_FILE_SLOTS) {
        const key = normalizeFilename(book[slot.filename])
        const file = book[slot.file]
        if (!key || !file) { continue }
        entries.push([key, file])
        total += file.size
      }
    }
    if (!entries.length) { return }
    // All or nothing. One unrestored file sends the author to the picker, which
    // replaces the whole selection, so a partial batch on disk could only ever
    // be deleted unread.
    if (total > await getPersistBudget()) { return }

    for (let index = 0; index < entries.length; index += PERSIST_CHUNK_SIZE) {
      if (runId !== persistRunId) { return }
      await bulkUploadFileStore.saveDraftFiles(entries.slice(index, index + PERSIST_CHUNK_SIZE))
    }
  }

  // Reattaches whatever survived, so a fully-restored batch stops claiming its
  // files are missing. Must run before the caller reads the books.
  async function reattachDraftFiles(restoredBooks: BulkUploadBook[]): Promise<void> {
    const pending = restoredBooks.filter(book => !hasArweaveUploads(book))
    const requests: DraftFileRequest[] = pending.flatMap(book =>
      BOOK_FILE_SLOTS
        .map(slot => normalizeFilename(book[slot.filename]))
        .filter(Boolean)
        .map(key => ({ key })))
    if (!requests.length) { return }

    const blobs = await bulkUploadFileStore.loadDraftFiles(requests)
    if (!blobs.size) { return }

    pending.forEach((book) => {
      BOOK_FILE_SLOTS.forEach((slot) => {
        const filename = book[slot.filename]
        const blob = blobs.get(normalizeFilename(filename))
        if (blob && filename) { book[slot.file] = toFile(blob, filename) }
      })
    })
  }

  async function resumeSession() {
    if (isResuming.value) { return }
    const session = loadBulkUploadSession()
    if (!session) { return }

    isResuming.value = true
    try {
      const restoredBooks = restoreBooksFromSession(session)
      // Before the books reach the view: needsFiles below decides which step
      // the author lands on, and it must see the restored files. The resume
      // banner stays put until then rather than flashing the CSV step.
      await reattachDraftFiles(restoredBooks)
      books.value = restoredBooks
      hasExistingSession.value = false

      // If all books have their Arweave uploads done, go straight to processing
      const needsFiles = books.value.some((b) => {
        if (hasArweaveUploads(b)) { return false }
        return !b.coverFile || (!b.pdfFile && !b.epubFile)
      })

      currentStep.value = needsFiles ? 'files' : 'processing'
    }
    finally {
      isResuming.value = false
    }
  }

  function resetWizard() {
    bulkUploadFileStore.clearDraftFiles()
    books.value = []
    validationErrors.value = []
    csvError.value = ''
    missingOptionalColumns.value = []
    selectedFiles.value = []
    unsupportedFiles.value = []
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
    isResuming,
    pendingBooks,
    completedBooks,
    failedBooks,
    unmatchedBooks,
    extraFiles,
    unsupportedFiles,
    fileMatchingStatus,
    handleCSVFileUpload,
    handleFilesChange,
    resumeSession,
    resetWizard,
  }
}
