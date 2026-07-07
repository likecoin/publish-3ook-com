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
      <UCard
        v-if="currentStep === 'csv'"
        :ui="{ body: 'space-y-4' }"
      >
        <template #header>
          <h3 class="font-bold">
            {{ $t('bulk_upload.step1_title') }}
          </h3>
        </template>

        <div class="flex items-end gap-4">
          <UFormField
            :label="$t('bulk_upload.upload_csv')"
            class="flex-1"
          >
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
      <UCard
        v-if="isVerifyingProgress"
        :ui="{ body: 'space-y-4' }"
      >
        <div class="flex items-center gap-3">
          <UIcon
            name="i-heroicons-arrow-path"
            class="animate-spin text-primary"
          />
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
            <li
              v-for="(error, index) in validationErrors"
              :key="index"
            >
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
      <UCard
        v-if="currentStep === 'files'"
        :ui="{ body: 'space-y-4' }"
      >
        <template #header>
          <h3 class="font-bold">
            {{ $t('bulk_upload.step2_title') }}
          </h3>
        </template>

        <UAlert
          v-if="missingOptionalColumns.length > 0"
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          variant="soft"
          :title="$t('bulk_upload.missing_optional_columns_warning')"
        >
          <template #description>
            <ul class="list-disc pl-4 mt-2 text-sm">
              <li
                v-for="col in missingOptionalColumns"
                :key="col.column"
              >
                <code>{{ col.column }}</code> → {{ $t('bulk_upload.csv_col_default') }}: <strong>{{ col.defaultValue }}</strong>
              </li>
            </ul>
          </template>
        </UAlert>

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

        <p
          v-if="selectedFiles.length > 0"
          class="text-sm font-medium"
        >
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
            @click="goToReview"
          />
        </div>
      </UCard>

      <!-- Step 3: Review -->
      <UCard
        v-if="currentStep === 'review'"
        :ui="{ body: 'space-y-4' }"
      >
        <template #header>
          <h3 class="font-bold">
            {{ $t('bulk_upload.review_title') }}
          </h3>
        </template>

        <p class="text-sm text-gray-600">
          {{ $t('bulk_upload.review_description') }}
        </p>

        <ArweaveSponsorStatus
          :is-sponsored="arweaveQuota.isSponsored"
          :remaining-uploads="arweaveQuota.remainingUploads"
          :required-uploads="arweaveQuota.requiredUploads"
        />
        <UAlert
          v-if="quotaIsPartial"
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          variant="soft"
          :title="$t('bulk_upload.arweave_quota_insufficient', {
            shortfallUploads: quotaShortfallUploads,
            shortfallBytes: formatBytes(quotaShortfallBytes),
          })"
        />

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
            { accessorKey: 'enableTTS', header: $t('bulk_upload.enable_tts') },
            { accessorKey: 'isPlusReadingEnabled', header: $t('bulk_upload.enable_library') },
            { accessorKey: 'isAutoDeliver', header: $t('bulk_upload.auto_deliver') },
            { accessorKey: 'autoMemo', header: $t('bulk_upload.auto_memo') },
          ]"
          :data="reviewData"
        >
          <template #enableDRM-cell="{ row }">
            <YesNoBadge :value="row.original.enableDRM" />
          </template>
          <template #enableTTS-cell="{ row }">
            <YesNoBadge :value="row.original.enableTTS" />
          </template>
          <template #isPlusReadingEnabled-cell="{ row }">
            <YesNoBadge :value="row.original.isPlusReadingEnabled" />
          </template>
          <template #isAutoDeliver-cell="{ row }">
            <YesNoBadge :value="row.original.isAutoDeliver" />
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
            :disabled="isEvaluatingQuota"
            :loading="isEvaluatingQuota"
            @click="startProcessing"
          />
        </div>
      </UCard>

      <!-- Step 4: Processing -->
      <UCard
        v-if="currentStep === 'processing'"
        :ui="{ body: 'space-y-4' }"
      >
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
        <div
          v-if="currentProcessingBook"
          class="p-4 bg-gray-50 rounded-lg"
        >
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
              <span
                v-if="row.original.error"
                class="text-xs text-red-600"
              >
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
        <div
          v-if="!isProcessing && completedBooks.length === books.length"
          class="flex justify-center gap-4"
        >
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
import { stringify as csvStringify } from 'csv-stringify/sync'
import type { BulkUploadBook } from '~/types/bulk-upload'
import { BookUploadStatus } from '~/types/bulk-upload'
import { generateResultCSV, getStatusColor, CSV_ALL_COLUMNS, CSV_REQUIRED_COLUMNS, CSV_OPTIONAL_COLUMNS_WITH_DEFAULTS } from '~/utils/bulk-upload'
import {
  clearBulkUploadSession,
  saveBulkUploadSession,
} from '~/utils/bulkUploadSession'

const { t: $t } = useI18n()
const { showSuccessToast, showErrorToast } = useToastComposable()
const { processBooksSequentially, currentStep: currentProcessingStep, currentBook: currentProcessingBook } = useBulkUpload()

// State
const {
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
} = useBulkUploadWizard()
const isProcessing = ref(false)
const isPaused = ref(false)

const {
  arweaveQuota,
  isEvaluatingQuota,
  quotaShortfallUploads,
  quotaShortfallBytes,
  quotaIsPartial,
  evaluateArweaveQuota,
} = useArweaveQuota({ books })

const csvColumnRefColumns = [
  { accessorKey: 'column', header: $t('bulk_upload.csv_col_column') },
  { accessorKey: 'required', header: $t('bulk_upload.csv_col_required') },
  { accessorKey: 'defaultValue', header: $t('bulk_upload.csv_col_default') },
  { accessorKey: 'description', header: $t('bulk_upload.csv_col_description') },
]

const csvColumnRefData = CSV_ALL_COLUMNS.map((col) => {
  const isRequired = CSV_REQUIRED_COLUMNS.includes(col)
  return {
    column: col,
    required: isRequired ? '✓' : '',
    defaultValue: CSV_OPTIONAL_COLUMNS_WITH_DEFAULTS[col] || '—',
    description: $t(`bulk_upload.csv_col_desc_${col}`),
  }
})

function formatPriceCell(book: BulkUploadBook): string {
  const base = book.listPrice === 0 ? 'Free' : `$${book.listPrice}`
  const overrides: string[] = []
  if (typeof book.listPriceHKD === 'number') { overrides.push(`HK$${book.listPriceHKD}`) }
  if (typeof book.listPriceTWD === 'number') { overrides.push(`NT$${book.listPriceTWD}`) }
  if (overrides.length === 0) { return base }
  return `${base} (${overrides.join(', ')})`
}

const reviewData = computed(() =>
  books.value.map(book => ({
    rowIndex: book.rowIndex,
    title: book.title,
    authorName: book.authorName,
    listPrice: formatPriceCell(book),
    editionName: book.editionName,
    language: book.language,
    enableDRM: book.enableDRM,
    enableTTS: book.enableTTS,
    isPlusReadingEnabled: book.isPlusReadingEnabled,
    isAutoDeliver: book.isAutoDeliver,
    autoMemo: book.autoMemo,
  })),
)

// SEO
useSeoMeta({
  title: $t('bulk_upload.page_title'),
  ogTitle: $t('bulk_upload.page_title'),
})

async function downloadCSVTemplate() {
  const { saveAs } = await import('file-saver')

  // Keep aligned with CSV_ALL_COLUMNS order (positional).
  const sampleRow = [
    'My Book Title', // book_title
    'A great book about...', // book_description
    '', // book_description_full
    'Author Name', // author_name
    'Author bio', // author_description
    'Publisher', // publisher
    'Publisher bio', // publisher_description
    '978-1234567890', // isbn
    '2024-01-15', // publish_date
    '4.99', // list_price
    '', // list_price_hkd
    '', // list_price_twd
    'fiction,novel', // tags
    'cover.jpg', // cover_image_filename
    '', // pdf_filename
    'book.epub', // epub_filename
    '', // edition_name
    '', // edition_description
    '', // auto_deliver
    '', // auto_memo
    '', // enable_drm
    '', // enable_tts
    '', // enable_library
    '', // language
  ]

  const csvContent = csvStringify([sampleRow], {
    header: true,
    columns: CSV_ALL_COLUMNS,
  })

  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, 'bulk-upload-template.csv')
}

async function goToReview() {
  currentStep.value = 'review'
  await evaluateArweaveQuota()
}

async function startProcessing() {
  // Resumed sessions can skip goToReview — re-evaluate here.
  const quotaInfo = await evaluateArweaveQuota()

  currentStep.value = 'processing'
  isProcessing.value = true
  isPaused.value = false

  // Save session
  saveBulkUploadSession(books.value, 0)

  await processBooksSequentially(books.value, {
    sponsored: quotaInfo.isSponsored,
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
      showErrorToast($t('bulk_upload.book_failed'), { description: error, duration: 5000 })
    },
    onBookComplete: (book, success) => {
      if (success) {
        showSuccessToast($t('bulk_upload.book_completed', { title: book.title }), { duration: 3000 })
      }
    },
    shouldContinue: () => !isPaused.value,
  })

  isProcessing.value = false

  if (completedBooks.value.length === books.value.length) {
    clearBulkUploadSession()
    showSuccessToast($t('bulk_upload.all_completed'))
  }
}

function pauseProcessing() {
  isPaused.value = true
}

function resumeProcessing() {
  isPaused.value = false
  startProcessing()
}

function retryFailed() {
  books.value.forEach((book) => {
    if (book.status === BookUploadStatus.FAILED) {
      book.status = BookUploadStatus.PENDING
      book.error = undefined
    }
  })
  startProcessing()
}

function clearAndStartNew() {
  clearBulkUploadSession()
  hasExistingSession.value = false
  resetAll()
}

function resetAll() {
  resetWizard()
  isProcessing.value = false
  isPaused.value = false
}

function getStatusLabel(status: BookUploadStatus): string {
  return $t(`bulk_upload.status_${status}`)
}
</script>
