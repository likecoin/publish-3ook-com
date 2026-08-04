<template>
  <div
    v-if="isSponsored || remainingUploads !== undefined"
    class="flex items-center gap-2 text-sm"
  >
    <template v-if="isSponsored">
      <UIcon
        name="i-heroicons-check-circle"
        class="w-4 h-4 shrink-0 text-green-500"
      />
      <span class="text-green-700">
        {{ sponsoredMessage }}
      </span>
    </template>
    <template v-else-if="remainingUploads !== undefined && remainingUploads <= 0">
      <UIcon
        name="i-heroicons-x-circle"
        class="w-4 h-4 shrink-0 text-red-500"
      />
      <span class="text-red-700">
        {{ $t('upload_form.arweave_quota_used') }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  isSponsored: boolean
  remainingUploads: number | undefined
  requiredUploads?: number
}>()

const { t } = useI18n()

const sponsoredMessage = computed(() => {
  if (props.remainingUploads === undefined) {
    return t('upload_form.arweave_sponsored_unlimited')
  }
  if (props.requiredUploads !== undefined && props.requiredUploads > 0) {
    return t('upload_form.arweave_sponsored_with_required', {
      required: props.requiredUploads,
      remaining: props.remainingUploads,
    })
  }
  return t('upload_form.arweave_sponsored', { remaining: props.remainingUploads })
})
</script>
