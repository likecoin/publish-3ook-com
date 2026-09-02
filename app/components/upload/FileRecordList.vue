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
              v-if="advisoryOf(record)"
              variant="ghost"
              color="warning"
              size="xs"
              icon="i-heroicons-exclamation-triangle"
              :aria-expanded="isExpanded(record)"
              :label="advisoryCopy(record, 'label')"
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

        <!-- Issues are advisory: the file still publishes. Shown in place rather
             than in a modal, which stole focus while files were still going in. -->
        <div
          v-if="isExpanded(record)"
          class="px-3 pb-3 space-y-2 text-sm"
        >
          <p
            class="text-xs text-muted"
            v-text="advisoryCopy(record, 'notice')"
          />
          <div
            v-if="record.validationErrors"
            class="text-error"
          >
            <p class="font-semibold mb-1">
              {{ $t('upload_form.epub_validation_errors') }}:
            </p>
            <pre class="whitespace-pre-wrap text-xs">{{ record.validationErrors }}</pre>
          </div>
          <div
            v-if="record.validationWarnings"
            class="text-warning"
          >
            <p class="font-semibold mb-1">
              {{ $t('upload_form.epub_validation_warnings') }}:
            </p>
            <pre class="whitespace-pre-wrap text-xs">{{ record.validationWarnings }}</pre>
          </div>
        </div>
      </li>
    </ul>
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

// Every advisory is non-blocking and they share one row, which shows the first
// that applies: a record can carry more than one condition, since a scan has no
// legible text either. Named rather than tested in the template — the label and
// the body would otherwise each re-derive which of them this is.
type FileAdvisory = 'epub-validation' | 'pdf-no-text-layer' | 'pdf-garbled-text' | undefined

const advisoryOf = (record: FileRecord): FileAdvisory => {
  if (record.hasValidationIssues) { return 'epub-validation' }
  // Ordered: a file with no text layer has no legible text either, and would
  // otherwise be told it is merely garbled.
  if (record.hasSearchableText === false) { return 'pdf-no-text-layer' }
  if (record.hasLegibleText === false) { return 'pdf-garbled-text' }
  return undefined
}

// The notice key does not follow from the label key, so both are listed. One
// table, so a further advisory cannot inherit another's copy by omission.
const ADVISORY_COPY: Record<NonNullable<FileAdvisory>, { label: string, notice: string }> = {
  'epub-validation': {
    label: 'upload_form.epub_has_issues',
    notice: 'upload_form.epub_validation_notice',
  },
  'pdf-no-text-layer': {
    label: 'upload_form.pdf_no_text_layer',
    notice: 'upload_form.pdf_no_text_layer_notice',
  },
  'pdf-garbled-text': {
    label: 'upload_form.pdf_garbled_text',
    notice: 'upload_form.pdf_garbled_text_notice',
  },
}

const advisoryCopy = (record: FileRecord, part: 'label' | 'notice') => {
  const advisory = advisoryOf(record)
  return advisory ? $t(ADVISORY_COPY[advisory][part]) : ''
}

const isExpanded = (record: FileRecord) =>
  !!advisoryOf(record) && !collapsed.value.has(record)

function toggleIssues(record: FileRecord) {
  if (!collapsed.value.delete(record)) { collapsed.value.add(record) }
}
</script>
