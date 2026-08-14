<template>
  <ul class="flex flex-col w-full">
    <li
      v-for="(record, index) of fileRecords"
      :key="`${record.fileName}-${index}`"
      class="border-b border-default"
    >
      <div class="flex justify-between items-center hover:bg-elevated transition-colors w-full py-[4px]">
        <ImgPreviewer
          :file-type="record.fileType"
          :file-data="record.fileData"
          size="small"
        />
        <div class="flex flex-col items-start grow">
          <p class="font-semibold text-highlighted">
            {{ record.fileName }}
          </p>
          <UBadge
            v-if="isGeneratedCoverRecord(record)"
            variant="soft"
            color="neutral"
            size="xs"
          >
            {{ $t('upload_form.file_generated_cover') }}
          </UBadge>
          <p class="text-muted text-sm">
            {{ Math.round((record.fileSize || 0) * 0.001) }} KB
          </p>
          <button
            v-if="needsFileReselect(record)"
            type="button"
            class="text-error hover:text-error/80 text-xs underline text-left cursor-pointer"
            @click="emit('reselect', index)"
            v-text="$t('upload_form.file_needs_reselect')"
          />
        </div>
        <div class="flex items-center gap-2">
          <UIcon
            v-if="isRecordUploaded(record)"
            name="i-heroicons-check-circle"
            class="w-5 h-5 text-success"
            :title="$t('upload_form.file_already_uploaded')"
          />
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
          <UIcon
            name="i-heroicons-trash"
            class="cursor-pointer text-error"
            @click="emit('delete', index)"
          />
        </div>
      </div>

      <!-- Issues are advisory: the file still publishes. Shown in place rather
           than in a modal, which stole focus while files were still going in. -->
      <div
        v-if="isExpanded(record)"
        class="pb-3 space-y-2 text-sm"
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
</template>

<script setup lang="ts">
import type { FileRecord } from '~/types'
import { needsFileReselect, isRecordUploaded, isGeneratedCoverRecord } from '~/utils/arweave'

const { t: $t } = useI18n()

defineProps<{
  fileRecords: FileRecord[]
}>()

const emit = defineEmits<{
  delete: [index: number]
  reselect: [index: number]
}>()

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
