<template>
  <div class="flex flex-col gap-2 text-left">
    <div
      v-for="item in checklistItems"
      :key="item.key"
      class="flex items-center gap-3 p-2 rounded-lg"
      :class="item.state === 'active' ? 'bg-primary-50' : ''"
    >
      <UIcon
        v-if="item.state === 'done'"
        name="i-heroicons-check-circle-solid"
        class="w-5 h-5 text-green-500"
      />
      <UIcon
        v-else-if="item.state === 'failed'"
        name="i-heroicons-x-circle-solid"
        class="w-5 h-5 text-red-500"
      />
      <UIcon
        v-else-if="item.state === 'active'"
        name="i-heroicons-arrow-path"
        class="w-5 h-5 text-primary-500 animate-spin"
      />
      <UIcon
        v-else
        name="i-heroicons-minus-circle"
        class="w-5 h-5 text-gray-300"
      />
      <span
        class="text-sm"
        :class="item.state === 'pending' ? 'text-gray-400' : 'text-gray-700'"
        v-text="item.label"
      />
    </div>
    <UAlert
      v-if="errorMessage"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="errorMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { BookUploadStatus } from '~/types/bulk-upload'

const { t: $t } = useI18n()

// status is the last pipeline *step* reached (uploading/creating/minting/
// listing, or completed); isFailed marks that step as the failure point.
const { status, isFailed = false, errorMessage = '' } = defineProps<{
  status: BookUploadStatus
  isFailed?: boolean
  errorMessage?: string
}>()

type ItemState = 'pending' | 'active' | 'done' | 'failed'

const STEP_ORDER = [
  BookUploadStatus.UPLOADING_FILES,
  BookUploadStatus.CREATING_NFT,
  BookUploadStatus.MINTING,
  BookUploadStatus.LISTING,
] as const

const stepLabels = computed<Record<(typeof STEP_ORDER)[number], string>>(() => ({
  [BookUploadStatus.UPLOADING_FILES]: $t('publish_progress.uploading_files'),
  [BookUploadStatus.CREATING_NFT]: $t('publish_progress.creating_nft_class'),
  [BookUploadStatus.MINTING]: $t('publish_progress.minting_nft'),
  [BookUploadStatus.LISTING]: $t('publish_progress.creating_listing'),
}))

const checklistItems = computed(() => {
  const activeIndex = STEP_ORDER.indexOf(status as (typeof STEP_ORDER)[number])
  const isCompleted = status === BookUploadStatus.COMPLETED

  return STEP_ORDER.map((step, index) => {
    let state: ItemState = 'pending'
    if (isCompleted || (activeIndex >= 0 && index < activeIndex)) {
      state = 'done'
    }
    else if (index === activeIndex) {
      state = isFailed ? 'failed' : 'active'
    }
    return {
      key: step,
      label: stepLabels.value[step],
      state,
    }
  })
})
</script>
