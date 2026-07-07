<template>
  <div class="flex flex-col w-full">
    <table class="w-full">
      <tbody class="w-full">
        <tr
          v-for="(
            { fileData, fileName, fileSize, fileType }, index
          ) of fileRecords"
          :key="fileName"
          class="flex justify-between items-center border-b-shade-gray border-b text-dark-gray hover:bg-light-gray transition-colors w-full"
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
              <p class="font-semibold text-gray-700">
                {{ fileName }}
              </p>
              <p class="text-gray-500 text-sm">
                {{ Math.round((fileSize || 0) * 0.001) }} KB
              </p>
              <p
                v-if="needsReselect(fileRecords[index])"
                class="text-yellow-600 text-xs"
                v-text="$t('upload_form.file_needs_reselect')"
              />
            </div>
          </td>
          <td class="flex items-center gap-2">
            <UIcon
              v-if="fileRecords[index]?.arweaveId"
              name="i-heroicons-check-circle"
              class="w-5 h-5 text-green-500"
              :title="$t('upload_form.file_already_uploaded')"
            />
            <UIcon
              v-if="fileRecords[index]?.hasValidationIssues"
              name="i-heroicons-exclamation-triangle"
              class="w-5 h-5 text-yellow-500 cursor-help"
              :title="$t('upload_form.epub_has_issues')"
              @click="emit('showIssues', fileRecords[index]!)"
            />
            <UIcon
              name="i-heroicons-trash"
              class="cursor-pointer text-red-500"
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

defineProps<{
  fileRecords: FileRecord[]
}>()

const emit = defineEmits<{
  delete: [index: number]
  showIssues: [record: FileRecord]
}>()

const needsReselect = (record?: FileRecord) => {
  return !!record && !record.fileBlob && !record.arweaveId
}
</script>
