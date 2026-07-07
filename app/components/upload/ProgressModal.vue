<template>
  <UModal
    :open="!!uploadStatus"
    :dismissible="false"
    class="p-4 gap-2"
  >
    <template #body>
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <UBadge variant="soft">
            {{ uploadStatus }}
          </UBadge>
          <p class="text-xs text-gray-500">
            {{ $t('upload_form.do_not_close_upload') }}
          </p>
        </div>
        <template v-if="totalFiles > 1">
          <div class="flex items-center text-sm text-gray-600">
            <span>{{ $t('upload_form.processing_file', { index: currentFileIndex, total: totalFiles }) }}</span>
          </div>
          <UProgress
            :value="Math.round((completedFiles / totalFiles) * 100)"
            color="primary"
            class="w-full"
          />
        </template>
        <UProgress
          v-else
          animation="carousel"
          color="primary"
          class="w-full"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
defineProps<{
  uploadStatus: string
  currentFileIndex: number
  totalFiles: number
  completedFiles: number
}>()
</script>
