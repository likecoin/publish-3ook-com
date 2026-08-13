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
            :label="advisoryLabel(record)"
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
          v-if="advisoryOf(record) === 'epub-validation'"
          class="text-xs text-muted"
          v-text="$t('upload_form.epub_validation_notice')"
        />
        <p
          v-if="advisoryOf(record) === 'pdf-no-text-layer'"
          class="text-xs text-muted"
          v-text="$t('upload_form.pdf_no_text_layer_notice')"
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

// Both advisories are non-blocking and share one row: a record can only ever
// carry one of them, since validation issues are an EPUB verdict and the text
// layer a PDF one. Named rather than tested twice in the template — the label
// and the body would otherwise each re-derive which of the two this is, and a
// third advisory would silently inherit the PDF copy.
type FileAdvisory = 'epub-validation' | 'pdf-no-text-layer' | undefined

const advisoryOf = (record: FileRecord): FileAdvisory => {
  if (record.hasValidationIssues) { return 'epub-validation' }
  if (record.hasSearchableText === false) { return 'pdf-no-text-layer' }
  return undefined
}

const ADVISORY_LABELS: Record<NonNullable<FileAdvisory>, string> = {
  'epub-validation': 'upload_form.epub_has_issues',
  'pdf-no-text-layer': 'upload_form.pdf_no_text_layer',
}

const advisoryLabel = (record: FileRecord) => {
  const advisory = advisoryOf(record)
  return advisory ? $t(ADVISORY_LABELS[advisory]) : ''
}

const isExpanded = (record: FileRecord) =>
  !!advisoryOf(record) && !collapsed.value.has(record)

function toggleIssues(record: FileRecord) {
  if (!collapsed.value.delete(record)) { collapsed.value.add(record) }
}
</script>
