<template>
  <div class="flex flex-col w-full">
    <table class="w-full">
      <tbody class="w-full">
        <tr
          v-for="(
            { fileData, fileName, fileSize, fileType }, index
          ) of fileRecords"
          :key="fileName"
          class="flex justify-between items-center border-b border-default hover:bg-elevated transition-colors w-full"
        >
          <td class="py-[4px]">
            <ImgPreviewer
              :file-type="fileType"
              :file-data="fileData"
              size="small"
            />
          </td>
          <td>
            <div class="flex flex-col">
              <p class="font-semibold text-highlighted">
                {{ fileName }}
              </p>
              <p class="text-muted text-sm">
                {{ Math.round((fileSize || 0) * 0.001) }} KB
              </p>
              <button
                v-if="needsReselect(fileRecords[index])"
                type="button"
                class="text-error hover:text-error/80 text-xs underline text-left cursor-pointer"
                @click="emit('reselect', index)"
                v-text="$t('upload_form.file_needs_reselect')"
              />
            </div>
          </td>
          <td class="flex items-center gap-2">
            <UIcon
              v-if="fileRecords[index]?.arweaveId"
              name="i-heroicons-check-circle"
              class="w-5 h-5 text-success"
              :title="$t('upload_form.file_already_uploaded')"
            />
            <UIcon
              v-if="fileRecords[index]?.hasValidationIssues"
              name="i-heroicons-exclamation-triangle"
              class="w-5 h-5 text-warning cursor-help"
              :title="$t('upload_form.epub_has_issues')"
              @click="emit('showIssues', fileRecords[index]!)"
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
import { needsFileReselect } from '~/utils/arweave'

defineProps<{
  fileRecords: FileRecord[]
}>()

const emit = defineEmits<{
  delete: [index: number]
  showIssues: [record: FileRecord]
  reselect: [index: number]
}>()

const needsReselect = (record?: FileRecord) => {
  return !!record && needsFileReselect(record)
}
</script>
