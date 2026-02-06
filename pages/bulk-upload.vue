<template>
  <PageContainer>
    <PageHeader :title="$t('bulk_upload.page_title')" />

    <PageBody>
      <!-- Resume Session Alert -->
      <UAlert
        v-if="hasExistingSession && !isProcessing"
        icon="i-heroicons-information-circle"
        color="info"
        variant="soft"
        :title="$t('bulk_upload.existing_session_found')"
        :description="$t('bulk_upload.existing_session_description')"
      >
        <template #actions>
          <div class="flex gap-2">
            <UButton
              :label="$t('bulk_upload.resume_session')"
              color="primary"
              @click="resumeSession"
            />
            <UButton
              :label="$t('bulk_upload.start_new')"
              variant="outline"
              @click="clearAndStartNew"
            />
          </div>
        </template>
      </UAlert>

      <!-- Step 1: CSV Upload -->
      <UCard v-if="currentStep === 'csv'" :ui="{ body: 'space-y-4' }">
        <template #header>
          <h3 class="font-bold">
            {{ $t('bulk_upload.step1_title') }}
          </h3>
        </template>

        <div class="flex items-end gap-4">
          <UFormField :label="$t('bulk_upload.upload_csv')" class="flex-1">
            <UInput
              type="file"
              accept=".csv"
              @change="handleCSVFileUpload"
            />
          </UFormField>
          <UButton
            :label="$t('bulk_upload.download_template')"
            variant="outline"
            icon="i-heroicons-arrow-down-tray"
            @click="downloadCSVTemplate"
          />
        </div>

        <details class="text-sm">
          <summary class="cursor-pointer font-medium text-gray-600 hover:text-gray-900">
            {{ $t('bulk_upload.csv_column_reference') }}
          </summary>
          <UTable
            class="mt-2"
            :columns="csvColumnRefColumns"
            :data="csvColumnRefData"
          />
        </details>
      </UCard>

      <!-- Verifying Progress Loading -->
      <UCard v-if="isVerifyingProgress" :ui="{ body: 'space-y-4' }">
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin text-primary" />
          <span>{{ $t('bulk_upload.verifying_progress') }}</span>
        </div>
      </UCard>

      <!-- Validation Errors -->
      <UAlert
        v-if="validationErrors.length > 0 && currentStep === 'csv'"
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('bulk_upload.validation_errors')"
      >
        <template #description>
          <ul class="list-disc pl-4 mt-2">
            <li v-for="(error, index) in validationErrors" :key="index">
              {{ $t('bulk_upload.error_row', { row: error.rowIndex }) }}: {{ error.field }} - {{ $t(error.message, error.params || {}) }}
            </li>
          </ul>
        </template>
      </UAlert>

      <!-- CSV-level Errors -->
      <UAlert
        v-if="csvError && currentStep === 'csv'"
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="csvError"
      />

      <!-- Step 2: File Selection -->
      <UCard v-if="currentStep === 'files'" :ui="{ body: 'space-y-4' }">
        <template #header>
          <h3 class="font-bold">
            {{ $t('bulk_upload.step2_title') }}
          </h3>
        </template>

        <p class="text-sm text-gray-600">
          {{ $t('bulk_upload.select_files_description', { count: books.length }) }}
        </p>

        <!-- Expected Files & Matching Status -->
        <div class="space-y-2">
          <p class="font-medium">
            {{ $t('bulk_upload.expected_files') }}
          </p>
          <UTable
            :columns="[
              { accessorKey: 'title', header: $t('bulk_upload.book_title') },
              { accessorKey: 'coverStatus', header: $t('bulk_upload.cover') },
              { accessorKey: 'pdfStatus', header: 'PDF' },
              { accessorKey: 'epubStatus', header: 'EPUB' },
            ]"
            :data="fileMatchingStatus"
          >
            <template #coverStatus-cell="{ row }">
              <UBadge
                v-if="row.original.coverFilename"
                :color="selectedFiles.length === 0 ? 'neutral' : row.original.hasCover ? 'success' : 'error'"
                variant="soft"
              >
                {{ row.original.coverFilename }}
              </UBadge>
            </template>
            <template #pdfStatus-cell="{ row }">
              <UBadge
                v-if="row.original.pdfFilename"
                :color="selectedFiles.length === 0 ? 'neutral' : row.original.hasPdf ? 'success' : 'error'"
                variant="soft"
              >
                {{ row.original.pdfFilename }}
              </UBadge>
            </template>
            <template #epubStatus-cell="{ row }">
              <UBadge
                v-if="row.original.epubFilename"
                :color="selectedFiles.length === 0 ? 'neutral' : row.original.hasEpub ? 'success' : 'error'"
                variant="soft"
              >
                {{ row.original.epubFilename }}
              </UBadge>
            </template>
          </UTable>
        </div>

        <UFormField :label="$t('bulk_upload.select_files')">
          <UInput
            type="file"
            multiple
            accept="image/*,.pdf,.epub"
            @change="handleFilesChange"
          />
        </UFormField>

        <p v-if="selectedFiles.length > 0" class="text-sm font-medium">
          {{ $t('bulk_upload.files_selected', { count: selectedFiles.length }) }}
        </p>

        <!-- Extra files warning -->
        <UAlert
          v-if="extraFiles.length > 0"
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          variant="soft"
          :title="$t('bulk_upload.extra_files_warning', { count: extraFiles.length })"
        >
          <template #description>
            <div class="flex flex-wrap gap-1 mt-2">
              <UBadge
                v-for="file in extraFiles"
                :key="file.name"
                variant="soft"
                color="warning"
              >
                {{ file.name }}
              </UBadge>
            </div>
          </template>
        </UAlert>

        <div class="flex justify-between">
          <UButton
            :label="$t('bulk_upload.back')"
            variant="outline"
            @click="currentStep = 'csv'"
          />
          <UButton
            :label="$t('bulk_upload.continue')"
            :disabled="unmatchedBooks.length > 0"
            @click="currentStep = 'review'"
          />
        </div>
      </UCard>

      <!-- Step 3: Review -->
      <UCard v-if="currentStep === 'review'" :ui="{ body: 'space-y-4' }">
        <template #header>
          <h3 class="font-bold">
            {{ $t('bulk_upload.review_title') }}
          </h3>
        </template>

        <p class="text-sm text-gray-600">
          {{ $t('bulk_upload.review_description') }}
        </p>

        <p class="font-medium">
          {{ $t('bulk_upload.total_transactions', { count: books.length }) }}
        </p>

        <UTable
          :columns="[
            { accessorKey: 'rowIndex', header: '#' },
            { accessorKey: 'title', header: $t('bulk_upload.book_title') },
            { accessorKey: 'authorName', header: $t('common.author') },
            { accessorKey: 'listPrice', header: $t('common.price') },
            { accessorKey: 'editionName', header: $t('form.edition') },
            { accessorKey: 'language', header: $t('form.language') },
            { accessorKey: 'enableDRM', header: $t('bulk_upload.enable_drm') },
            { accessorKey: 'isAutoDeliver', header: $t('bulk_upload.auto_deliver') },
            { accessorKey: 'autoMemo', header: $t('bulk_upload.auto_memo') },
          ]"
          :data="reviewData"
        >
          <template #enableDRM-cell="{ row }">
            <UBadge
              :color="'warning'"
              variant="soft"
            >
              {{ row.original.enableDRM ? $t('common.yes') : $t('common.no') }}
            </UBadge>
          </template>
          <template #isAutoDeliver-cell="{ row }">
            <UBadge
              :color="row.original.isAutoDeliver ? 'success' : 'neutral'"
              variant="soft"
            >
              {{ row.original.isAutoDeliver ? $t('common.yes') : $t('common.no') }}
            </UBadge>
          </template>
        </UTable>

        <div class="flex justify-between">
          <UButton
            :label="$t('bulk_upload.back')"
            variant="outline"
            @click="currentStep = 'files'"
          />
          <UButton
            :label="$t('bulk_upload.start_upload')"
            color="primary"
            @click="startProcessing"
          />
        </div>
      </UCard>

      <!-- Step 4: Processing -->
      <UCard v-if="currentStep === 'processing'" :ui="{ body: 'space-y-4' }">
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="font-bold">
              {{ $t('bulk_upload.step4_title') }}
            </h3>
            <div class="flex gap-2">
              <UButton
                v-if="isProcessing && !isPaused"
                :label="$t('bulk_upload.pause')"
                variant="outline"
                @click="pauseProcessing"
              />
              <UButton
                v-if="isPaused"
                :label="$t('bulk_upload.resume')"
                color="primary"
                @click="resumeProcessing"
              />
              <UButton
                v-if="!isProcessing && failedBooks.length > 0"
                :label="$t('bulk_upload.retry_failed')"
                variant="outline"
                @click="retryFailed"
              />
              <UButton
                v-if="!isProcessing"
                :label="$t('bulk_upload.download_result_csv')"
                variant="outline"
                icon="i-heroicons-arrow-down-tray"
                @click="generateResultCSV(books)"
              />
            </div>
          </div>
        </template>

        <!-- Progress Summary -->
        <div class="flex gap-4 text-sm">
          <span>{{ $t('bulk_upload.total') }}: {{ books.length }}</span>
          <span class="text-green-600">{{ $t('bulk_upload.completed') }}: {{ completedBooks.length }}</span>
          <span class="text-red-600">{{ $t('bulk_upload.failed') }}: {{ failedBooks.length }}</span>
          <span class="text-gray-500">{{ $t('bulk_upload.pending') }}: {{ pendingBooks.length }}</span>
        </div>

        <UProgress
          v-if="isProcessing || failedBooks.length > 0 || (completedBooks.length > 0 && completedBooks.length < books.length)"
          :value="((completedBooks.length + failedBooks.length) / books.length) * 100"
          :color="failedBooks.length > 0 ? 'error' : 'primary'"
        />

        <!-- Current Processing Status -->
        <div v-if="currentProcessingBook" class="p-4 bg-gray-50 rounded-lg">
          <p class="font-medium">
            {{ $t('bulk_upload.currently_processing') }}: {{ currentProcessingBook.title }}
          </p>
          <p class="text-sm text-gray-600">
            {{ currentProcessingStep ? $t(`bulk_upload.step_${currentProcessingStep}`) : '' }}
          </p>
        </div>

        <!-- Books Table -->
        <UTable
          :columns="[
            { accessorKey: 'rowIndex', header: '#' },
            { accessorKey: 'title', header: $t('bulk_upload.book_title') },
            { accessorKey: 'status', header: $t('bulk_upload.status') },
            { accessorKey: 'actions', header: '' },
          ]"
          :data="books"
        >
          <template #status-cell="{ row }">
            <div class="flex items-center gap-2">
              <UBadge
                :color="getStatusColor(row.original.status)"
                variant="soft"
              >
                {{ getStatusLabel(row.original.status) }}
              </UBadge>
              <span v-if="row.original.error" class="text-xs text-red-600">
                {{ row.original.error }}
              </span>
            </div>
          </template>
          <template #actions-cell="{ row }">
            <UButton
              v-if="row.original.status === BookUploadStatus.COMPLETED && row.original.classId"
              :to="`/my-books/status/${row.original.classId}`"
              variant="link"
              size="xs"
            >
              {{ $t('bulk_upload.view') }}
            </UButton>
          </template>
        </UTable>

        <!-- Completion Actions -->
        <div v-if="!isProcessing && completedBooks.length === books.length" class="flex justify-center gap-4">
          <UButton
            :label="$t('bulk_upload.view_my_books')"
            to="/my-books"
          />
          <UButton
            :label="$t('bulk_upload.upload_more')"
            variant="outline"
            @click="resetAll"
          />
        </div>
      </UCard>
    </PageBody>
  </PageContainer>
</template>

<script setup lang="ts">
import { parse as csvParse } from 'csv-parse/sync'
import { stringify as csvStringify } from 'csv-stringify/sync'
import { getTransactionReceipt } from '@wagmi/vue/actions'
import type { BulkUploadBook, BulkUploadCSVRow, BulkUploadValidationError } from '~/utils/bulk-upload.type'
import { BookUploadStatus, parseCSVRow, validateBook, validateBooks, validateProgressFieldFormats, generateResultCSV, CSV_ALL_COLUMNS, CSV_REQUIRED_COLUMNS } from '~/utils/bulk-upload.type'
import {
  loadBulkUploadSession,
  clearBulkUploadSession,
  saveBulkUploadSession,
  restoreBooksFromSession
} from '~/utils/bulkUploadSession'

const { t: $t } = useI18n()
const toast = useToast()
const { processBooksSequentially, currentStep: currentProcessingStep, currentBook: currentProcessingBook } = useBulkUpload()
const { getClassMetadata } = useNFTContractReader()
const { $wagmiConfig } = useNuxtApp()

// State
const currentStep = ref<'csv' | 'files' | 'review' | 'processing'>('csv')
const isVerifyingProgress = ref(false)
const books = ref<BulkUploadBook[]>([])
const validationErrors = ref<BulkUploadValidationError[]>([])
const csvError = ref('')
const selectedFiles = ref<File[]>([])
const isProcessing = ref(false)
const isPaused = ref(false)
const hasExistingSession = ref(false)

// Computed
const pendingBooks = computed(() =>
  books.value.filter(b => b.status === BookUploadStatus.PENDING)
)

const completedBooks = computed(() =>
  books.value.filter(b => b.status === BookUploadStatus.COMPLETED)
)

const failedBooks = computed(() =>
  books.value.filter(b => b.status === BookUploadStatus.FAILED)
)

const unmatchedBooks = computed(() =>
  books.value.filter((b) => {
    if (b.status === BookUploadStatus.COMPLETED) { return false }
    if (b.coverArweaveId && b.bookArweaveId) { return false }
    return !b.coverFile || (!b.pdfFile && !b.epubFile)
  })
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
  selectedFiles.value.filter(f => !expectedFilenameSet.value.has(f.name.toLowerCase()))
)

const fileMatchingStatus = computed(() =>
  books.value.map(book => ({
    title: book.title,
    hasCover: !!book.coverFile,
    coverFilename: book.coverImageFilename,
    hasPdf: !!book.pdfFile,
    pdfFilename: book.pdfFilename || '',
    hasEpub: !!book.epubFile,
    epubFilename: book.epubFilename || ''
  }))
)

const csvColumnRefColumns = [
  { accessorKey: 'column', header: $t('bulk_upload.csv_col_column') },
  { accessorKey: 'required', header: $t('bulk_upload.csv_col_required') },
  { accessorKey: 'defaultValue', header: $t('bulk_upload.csv_col_default') },
  { accessorKey: 'description', header: $t('bulk_upload.csv_col_description') }
]

const csvColumnRefData = CSV_ALL_COLUMNS.map((col) => {
  const isRequired = CSV_REQUIRED_COLUMNS.includes(col)
  const defaults: Record<string, string> = {
    list_price: '4.99',
    edition_name: '標準版',
    edition_description: '標準數位版',
    auto_deliver: 'true',
    enable_drm: 'false',
    language: 'zh'
  }
  return {
    column: col,
    required: isRequired ? '✓' : '',
    defaultValue: defaults[col] || '—',
    description: $t(`bulk_upload.csv_col_desc_${col}`)
  }
})

const reviewData = computed(() =>
  books.value.map(book => ({
    rowIndex: book.rowIndex,
    title: book.title,
    authorName: book.authorName,
    listPrice: book.listPrice === 0 ? 'Free' : `$${book.listPrice}`,
    editionName: book.editionName,
    language: book.language,
    enableDRM: book.enableDRM,
    isAutoDeliver: book.isAutoDeliver,
    autoMemo: book.autoMemo
  }))
)

// SEO
useSeoMeta({
  title: $t('bulk_upload.page_title'),
  ogTitle: $t('bulk_upload.page_title')
})

// Initialize
onMounted(() => {
  hasExistingSession.value = loadBulkUploadSession() !== null
})

// Methods
function handleCSVFileUpload (event: Event) {
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

async function parseCSV (csvContent: string) {
  validationErrors.value = []
  csvError.value = ''

  try {
    const records = csvParse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
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

    const hasProgressColumns = headers.includes('status') || headers.includes('class_id')
    const parsedBooks: BulkUploadBook[] = []
    const allErrors: BulkUploadValidationError[] = []

    records.forEach((row: any, index: number) => {
      const book = parseCSVRow(row, index + 1)
      const errors = validateBook(book)

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
      } finally {
        isVerifyingProgress.value = false
      }
    }

    books.value = parsedBooks
    currentStep.value = 'files'

    toast.add({
      icon: 'i-heroicons-check-circle',
      title: $t('bulk_upload.csv_parsed_success', { count: parsedBooks.length }),
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: $t('bulk_upload.csv_parse_error'),
      description: error.message,
      color: 'error'
    })
  }
}

async function verifyProgressFieldsOnChain (booksToVerify: BulkUploadBook[]) {
  for (const book of booksToVerify) {
    if (book.classId) {
      try {
        await getClassMetadata(book.classId)
      } catch {
        book.classId = undefined
        book.mintTxHash = undefined
        if (book.status === BookUploadStatus.COMPLETED) {
          book.status = BookUploadStatus.PENDING
        }
      }
    }

    if (book.mintTxHash) {
      try {
        await getTransactionReceipt($wagmiConfig, { hash: book.mintTxHash as `0x${string}` })
      } catch {
        book.mintTxHash = undefined
      }
    }
  }
}

async function downloadCSVTemplate () {
  const { saveAs } = await import('file-saver')

  const sampleRow = [
    'My Book Title',
    'A great book about...',
    'Author Name',
    'Author bio',
    'Publisher',
    '978-1234567890',
    '2024-01-15',
    '4.99',
    'fiction,novel',
    'cover.jpg',
    '',
    'book.epub',
    '',
    '',
    '',
    '',
    '',
    ''
  ]

  const csvContent = csvStringify([sampleRow], {
    header: true,
    columns: CSV_ALL_COLUMNS
  })

  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, 'bulk-upload-template.csv')
}

function handleFilesChange (event: Event) {
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

async function startProcessing () {
  currentStep.value = 'processing'
  isProcessing.value = true
  isPaused.value = false

  // Save session
  saveBulkUploadSession(books.value, 0)

  await processBooksSequentially(books.value, {
    onStatusChange: (bookId, status, error) => {
      const book = books.value.find(b => b.id === bookId)
      if (book) {
        book.status = status
        if (error) { book.error = error }
        saveBulkUploadSession(books.value, 0)
      }
    },
    onProgress: (bookId, updates) => {
      const book = books.value.find(b => b.id === bookId)
      if (book) {
        Object.assign(book, updates)
        saveBulkUploadSession(books.value, 0)
      }
    },
    onError: (_bookId, error) => {
      toast.add({
        icon: 'i-heroicons-exclamation-circle',
        title: $t('bulk_upload.book_failed'),
        description: error,
        color: 'error',
        duration: 5000
      })
    },
    onBookComplete: (book, success) => {
      if (success) {
        toast.add({
          icon: 'i-heroicons-check-circle',
          title: $t('bulk_upload.book_completed', { title: book.title }),
          color: 'success',
          duration: 3000
        })
      }
    },
    shouldContinue: () => !isPaused.value
  })

  isProcessing.value = false

  if (completedBooks.value.length === books.value.length) {
    clearBulkUploadSession()
    toast.add({
      icon: 'i-heroicons-check-circle',
      title: $t('bulk_upload.all_completed'),
      color: 'success'
    })
  }
}

function pauseProcessing () {
  isPaused.value = true
}

function resumeProcessing () {
  isPaused.value = false
  startProcessing()
}

function retryFailed () {
  books.value.forEach((book) => {
    if (book.status === BookUploadStatus.FAILED) {
      book.status = BookUploadStatus.PENDING
      book.error = undefined
    }
  })
  startProcessing()
}

function resumeSession () {
  const session = loadBulkUploadSession()
  if (!session) { return }

  books.value = restoreBooksFromSession(session)

  // If all books have their Arweave uploads done, go straight to processing
  const needsFiles = books.value.some((b) => {
    if (b.coverArweaveId && b.bookArweaveId) { return false }
    return !b.coverFile || (!b.pdfFile && !b.epubFile)
  })

  if (needsFiles) {
    currentStep.value = 'files'
  } else {
    currentStep.value = 'processing'
  }
}

function clearAndStartNew () {
  clearBulkUploadSession()
  resetAll()
}

function resetAll () {
  books.value = []
  validationErrors.value = []
  csvError.value = ''
  selectedFiles.value = []
  currentStep.value = 'csv'
  isProcessing.value = false
  isPaused.value = false
}

function getStatusColor (status: BookUploadStatus): 'success' | 'error' | 'neutral' | 'info' {
  switch (status) {
    case BookUploadStatus.COMPLETED:
      return 'success'
    case BookUploadStatus.FAILED:
      return 'error'
    case BookUploadStatus.PENDING:
      return 'neutral'
    default:
      return 'info'
  }
}

function getStatusLabel (status: BookUploadStatus): string {
  return $t(`bulk_upload.status_${status}`)
}
</script>
