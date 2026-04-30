<template>
  <div v-if="isSponsored || remainingUploads !== undefined" class="flex items-center gap-2 text-sm">
    <template v-if="isSponsored">
      <UIcon name="i-heroicons-check-circle" class="w-4 h-4 shrink-0 text-green-500" />
      <span class="text-green-700">
        {{ remainingUploads === undefined
          ? $t('upload_form.arweave_sponsored_unlimited')
          : $t('upload_form.arweave_sponsored', { remaining: remainingUploads }) }}
      </span>
    </template>
    <template v-else-if="remainingUploads !== undefined && remainingUploads <= 0">
      <UIcon name="i-heroicons-clock" class="w-4 h-4 shrink-0 text-gray-400" />
      <span class="text-gray-500">
        {{ $t('upload_form.arweave_quota_used') }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isSponsored: boolean
  remainingUploads: number | undefined
}>()
</script>
