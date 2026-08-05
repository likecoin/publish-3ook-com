<template>
  <ul class="flex flex-col w-full">
    <li
      v-for="(record, index) of fileRecords"
      :key="record.fileName"
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
            v-if="isGeneratedCover(record)"
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
            v-if="record.hasValidationIssues"
            variant="ghost"
            color="warning"
            size="xs"
            icon="i-heroicons-exclamation-triangle"
            :aria-expanded="isExpanded(record)"
            :label="$t('upload_form.epub_has_issues')"
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
          v-text="$t('upload_form.epub_validation_notice')"
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
import { needsFileReselect, isRecordUploaded } from '~/utils/arweave'

defineProps<{
  fileRecords: FileRecord[]
}>()

const emit = defineEmits<{
  delete: [index: number]
  reselect: [index: number]
}>()

// The EPUB's own cover, extracted during processing rather than picked by the
// author. Same suffix validateFiles uses to tell the two apart.
const isGeneratedCover = (record: FileRecord) => !!record.fileName?.endsWith('_cover.jpeg')

// Tracks what was dismissed rather than what is open, so a file's issues are
// visible the moment it lands and stay hidden once the author collapses them.
const collapsed = ref(new Set<string>())

const isExpanded = (record: FileRecord) =>
  !!record.hasValidationIssues && !collapsed.value.has(record.fileName || '')

function toggleIssues(record: FileRecord) {
  const key = record.fileName || ''
  const next = new Set(collapsed.value)
  if (!next.delete(key)) { next.add(key) }
  collapsed.value = next
}
</script>
