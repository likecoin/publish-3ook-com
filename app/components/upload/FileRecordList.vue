<template>
  <!-- Cover left, book files beside it — the book page's 書檔 anatomy, so a
       cover reads as a picture in both places. -->
  <div class="flex gap-6 w-full">
    <!-- w-40, not w-fit: the label row sits under the thumbnail, and at the
         thumbnail's own 120px it wraps. -->
    <div
      v-if="coverEntry"
      class="w-40 shrink-0 flex flex-col items-start gap-2"
    >
      <BookCoverThumbnail
        :src="coverEntry.record.fileData"
        :alt="coverEntry.record.fileName"
        size="lg"
      />
      <div class="flex items-center gap-1">
        <p
          class="text-sm font-semibold"
          v-text="$t('upload_form.file_cover')"
        />
        <UTooltip
          :text="$t('publish_cover.hint')"
          :ui="{ content: 'h-auto max-w-64', text: 'whitespace-normal' }"
        >
          <UButton
            :aria-label="$t('publish_cover.hint')"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-question-mark-circle"
            class="rounded-full"
          />
        </UTooltip>
      </div>
      <button
        v-if="needsFileReselect(coverEntry.record)"
        type="button"
        class="text-error hover:text-error/80 text-xs underline text-left cursor-pointer"
        @click="emit('reselect', coverEntry.index)"
        v-text="$t('upload_form.file_needs_reselect')"
      />
    </div>

    <ul class="flex flex-col grow min-w-0 gap-2">
      <li
        v-for="{ record, index } of displayedRecords"
        :key="`${record.fileName}-${index}`"
        class="rounded-lg border border-default overflow-hidden"
      >
        <div class="flex justify-between items-center gap-3 hover:bg-muted transition-colors w-full px-3 py-2">
          <UIcon
            :name="isCoverRecord(record) ? 'i-heroicons-photo' : 'i-heroicons-book-open'"
            class="shrink-0 w-10 h-10 text-muted"
          />
          <div class="flex flex-col items-start grow">
            <p class="font-semibold text-highlighted">
              {{ record.fileName }}
            </p>
            <p
              class="text-muted text-sm"
              v-text="formatBytes(record.fileSize || 0)"
            />
            <div class="mt-1 flex items-center gap-2 empty:hidden">
              <UBadge
                v-if="isCoverRecord(record)"
                variant="soft"
                color="neutral"
                size="sm"
                :label="isGeneratedCoverRecord(record)
                  ? $t('upload_form.file_generated_cover')
                  : $t('upload_form.file_cover')"
              />
              <UTooltip
                v-if="isRecordUploaded(record)"
                :text="$t('upload_form.file_already_uploaded')"
              >
                <UIcon
                  name="i-heroicons-cloud-arrow-up"
                  class="w-5 h-5 text-success"
                />
              </UTooltip>
            </div>
            <button
              v-if="needsFileReselect(record)"
              type="button"
              class="text-error hover:text-error/80 text-xs underline text-left cursor-pointer"
              @click="emit('reselect', index)"
              v-text="$t('upload_form.file_needs_reselect')"
            />
          </div>
          <div class="flex items-center gap-2">
            <UButton
              v-if="pdfAdvisoryOf(record)"
              variant="ghost"
              color="warning"
              size="xs"
              icon="i-heroicons-exclamation-triangle"
              :aria-expanded="isExpanded(record)"
              :label="pdfAdvisoryCopy(record, 'label')"
              :trailing-icon="isExpanded(record) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
              @click="toggleIssues(record)"
            />
            <UButton
              v-if="canRevertCover && isManualCoverRecord(record)"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-arrow-uturn-left"
              :label="$t('publish_cover.revert')"
              @click="emit('revertCover')"
            />
            <UButton
              color="error"
              variant="ghost"
              size="xs"
              icon="i-heroicons-trash"
              :aria-label="$t('common.delete')"
              @click="emit('delete', index)"
            />
          </div>
        </div>

        <p
          v-if="isExpanded(record)"
          class="px-3 pb-3 text-xs text-muted"
          v-text="pdfAdvisoryCopy(record, 'notice')"
        />

        <!-- Details open in a modal only on 查看詳情;
             one that popped up by itself stole focus while files were still going in. -->
        <template v-if="record.hasValidationIssues">
          <div
            role="status"
            :class="['flex flex-wrap items-center justify-between gap-x-2 border-t border-default ps-3 pe-2 py-1.5', epubStatusOf(record).tint]"
          >
            <p :class="['flex items-center gap-2 text-sm font-semibold', epubStatusOf(record).text]">
              <UIcon
                name="i-heroicons-exclamation-triangle"
                class="shrink-0 size-5"
              />
              {{ $t(epubStatusOf(record).title) }}
            </p>
            <div class="flex items-center gap-2 ms-auto">
              <span
                class="text-xs text-toned"
                v-text="epubIssueSummary(record)"
              />
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-heroicons-list-bullet"
                :label="$t('upload_form.epub_issues_view')"
                @click="issuesRecord = record"
              />
            </div>
          </div>
          <div class="px-3 py-3 space-y-3 border-t border-default">
            <p
              :id="`${noticeIdPrefix}-${index}`"
              class="text-sm text-muted"
              v-text="$t(epubStatusOf(record).notice)"
            />
            <UCheckbox
              v-if="record.validationErrors"
              :model-value="!!record.hasAcknowledgedValidationErrors"
              :label="$t('upload_form.epub_errors_acknowledge')"
              :aria-describedby="`${noticeIdPrefix}-${index}`"
              color="error"
              @update:model-value="(value: boolean | 'indeterminate') => emit('acknowledgeErrors', index, value === true)"
            />
          </div>
        </template>
      </li>
    </ul>

    <UModal
      :open="!!issuesRecord"
      :title="$t('upload_form.epub_issues_modal_title')"
      :description="issuesRecord?.fileName"
      :ui="{ footer: 'justify-end' }"
      @update:open="(isOpen: boolean) => { if (!isOpen) issuesRecord = null }"
    >
      <template #body>
        <div class="space-y-4">
          <section
            v-for="group of issueGroups"
            :key="group.heading"
          >
            <h3
              :class="['text-sm font-semibold', group.textClass]"
              v-text="group.heading"
            />
            <ul :class="['mt-1 space-y-1 font-mono text-xs whitespace-pre-wrap break-words', group.textClass]">
              <li
                v-for="(item, itemIndex) of group.items"
                :key="itemIndex"
                v-text="item"
              />
            </ul>
          </section>
        </div>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="outline"
          :label="$t('common.close')"
          @click="issuesRecord = null"
        />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { FileRecord } from '~/types'
import { needsFileReselect, isRecordUploaded, isGeneratedCoverRecord, isManualCoverRecord, isCoverRecord } from '~/utils/arweave'
import { formatBytes } from '~/utils'

const { t: $t } = useI18n()

const { fileRecords, canRevertCover = false } = defineProps<{
  fileRecords: FileRecord[]
  // Whether the ebook's own cover is still around to go back to; the row only
  // offers 復原 when it is.
  canRevertCover?: boolean
}>()

const emit = defineEmits<{
  delete: [index: number]
  reselect: [index: number]
  revertCover: []
  acknowledgeErrors: [index: number, isAcknowledged: boolean]
}>()

// Both covers are kept — 復原 needs the ebook's own — but only one of them is
// this book's cover, so the superseded row is hidden. Indices are carried
// along: delete and reselect address the unfiltered array.
const displayedRecords = computed(() => {
  const hasManualCover = fileRecords.some(record => isManualCoverRecord(record))
  return fileRecords
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => !(hasManualCover && isGeneratedCoverRecord(record)))
})

// At most one cover survives the filter above, which is what makes this a
// single entry rather than a list.
const coverEntry = computed(() =>
  displayedRecords.value.find(({ record }) => isCoverRecord(record)))

// Tracks what was dismissed rather than what is open, so a file's issues are
// visible the moment it lands and stay hidden once the author collapses them.
// Keyed by record, not by name: upsertFileRecord only replaces a same-named
// record that has no blob, so two drops of one filename coexist as two rows.
const collapsed = ref(new Set<FileRecord>())

type PdfAdvisory = 'pdf-no-text-layer' | 'pdf-garbled-text' | undefined

const pdfAdvisoryOf = (record: FileRecord): PdfAdvisory => {
  // Ordered: a file with no text layer has no legible text either, and would
  // otherwise be told it is merely garbled.
  if (record.hasSearchableText === false) { return 'pdf-no-text-layer' }
  if (record.hasLegibleText === false) { return 'pdf-garbled-text' }
  return undefined
}

// The notice key does not follow from the label key, so both are listed. One
// table, so a further advisory cannot inherit another's copy by omission.
const PDF_ADVISORY_COPY: Record<NonNullable<PdfAdvisory>, { label: string, notice: string }> = {
  'pdf-no-text-layer': {
    label: 'upload_form.pdf_no_text_layer',
    notice: 'upload_form.pdf_no_text_layer_notice',
  },
  'pdf-garbled-text': {
    label: 'upload_form.pdf_garbled_text',
    notice: 'upload_form.pdf_garbled_text_notice',
  },
}

const pdfAdvisoryCopy = (record: FileRecord, part: 'label' | 'notice') => {
  const advisory = pdfAdvisoryOf(record)
  return advisory ? $t(PDF_ADVISORY_COPY[advisory][part]) : ''
}

const isExpanded = (record: FileRecord) =>
  !!pdfAdvisoryOf(record) && !collapsed.value.has(record)

function toggleIssues(record: FileRecord) {
  if (!collapsed.value.delete(record)) { collapsed.value.add(record) }
}

// Errors outrank warnings: the panel takes the colour and copy of the worse.
const EPUB_STATUS = {
  errors: {
    tint: 'bg-error/10',
    text: 'text-error-700',
    title: 'upload_form.epub_has_errors',
    notice: 'upload_form.epub_errors_notice',
  },
  warnings: {
    tint: 'bg-warning/10',
    text: 'text-warning-700',
    title: 'upload_form.epub_has_issues',
    notice: 'upload_form.epub_validation_notice',
  },
}

const epubStatusOf = (record: FileRecord) =>
  EPUB_STATUS[record.validationErrors ? 'errors' : 'warnings']

const noticeIdPrefix = useId()

// validateEpub joins one "• " line per message; a message may itself span lines.
const splitIssues = (text?: string) => text ? text.split(/\n(?=• )/) : []

const epubIssueSummary = (record: FileRecord) => {
  const errorCount = splitIssues(record.validationErrors).length
  const warningCount = splitIssues(record.validationWarnings).length
  const errors = errorCount ? $t('upload_form.epub_error_count', errorCount) : ''
  const warnings = warningCount ? $t('upload_form.epub_warning_count', warningCount) : ''
  return errors && warnings
    ? $t('upload_form.epub_issue_counts', { errors, warnings })
    : errors || warnings
}

const issuesRecord = ref<FileRecord | null>(null)

const issueGroups = computed(() => {
  const errors = splitIssues(issuesRecord.value?.validationErrors)
  const warnings = splitIssues(issuesRecord.value?.validationWarnings)
  return [
    { heading: $t('upload_form.epub_validation_errors', { n: errors.length }), items: errors, textClass: 'text-error-700' },
    { heading: $t('upload_form.epub_validation_warnings', { n: warnings.length }), items: warnings, textClass: 'text-warning-700' },
  ].filter(group => group.items.length)
})
</script>
