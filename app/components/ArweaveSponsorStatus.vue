<template>
  <UAlert
    v-if="isSponsored"
    color="success"
    variant="subtle"
    icon="i-heroicons-check-circle"
    :description="sponsoredMessage"
  />
  <UAlert
    v-else-if="remainingUploads !== undefined && remainingUploads <= 0"
    color="error"
    variant="subtle"
    icon="i-heroicons-x-circle"
    :description="$t('upload_form.arweave_quota_used')"
  />
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
