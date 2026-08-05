<template>
  <div class="flex flex-col w-full">
    <table class="w-full">
      <tbody class="w-full">
        <tr
          v-for="(record, index) of fileRecords"
          :key="record.fileName"
          class="flex justify-between items-center border-b border-default hover:bg-elevated transition-colors w-full"
        >
          <td class="py-[4px]">
            <ImgPreviewer
              :file-type="record.fileType"
              :file-data="record.fileData"
              size="small"
            />
          </td>
          <td>
            <div class="flex flex-col items-start">
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
          </td>
          <td class="flex items-center gap-2">
            <UIcon
              v-if="isRecordUploaded(record)"
              name="i-heroicons-check-circle"
              class="w-5 h-5 text-success"
              :title="$t('upload_form.file_already_uploaded')"
            />
            <UIcon
              v-if="record.hasValidationIssues"
              name="i-heroicons-exclamation-triangle"
              class="w-5 h-5 text-warning cursor-help"
              :title="$t('upload_form.epub_has_issues')"
              @click="emit('showIssues', record)"
            />
            <UIcon
              name="i-heroicons-trash"
              class="cursor-pointer text-error"
              @click="emit('delete', index)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { FileRecord } from '~/types'
import { needsFileReselect, isRecordUploaded } from '~/utils/arweave'

defineProps<{
  fileRecords: FileRecord[]
}>()

const emit = defineEmits<{
  delete: [index: number]
  showIssues: [record: FileRecord]
  reselect: [index: number]
}>()

// The EPUB's own cover, extracted during processing rather than picked by the
// author. Same suffix validateFiles uses to tell the two apart.
const isGeneratedCover = (record: FileRecord) => !!record.fileName?.endsWith('_cover.jpeg')
</script>
