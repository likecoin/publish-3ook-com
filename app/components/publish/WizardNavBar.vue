<template>
  <!-- Rendered in the page navbar so the way on is visible at every step:
       書籍資料 is long enough that a bottom bar would sit below the fold. -->
  <div class="flex items-center gap-4">
    <p
      v-if="savedLabel"
      class="hidden sm:flex items-center gap-1.5 text-sm text-muted truncate"
    >
      <UIcon
        name="i-heroicons-check-circle"
        class="text-success shrink-0"
      />
      <span v-text="savedLabel" />
    </p>
    <div class="flex items-center gap-2 shrink-0">
      <UButton
        v-if="canGoBack"
        variant="outline"
        color="neutral"
        :disabled="isBusy"
        :label="$t('publish_wizard.back')"
        @click="emit('back')"
      />
      <UButton
        :label="nextLabel"
        :loading="isBusy"
        :disabled="isBusy || isNextDisabled"
        @click="emit('next')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const { t: $t, locale } = useI18n()

const {
  nextLabel,
  canGoBack = false,
  isNextDisabled = false,
  isBusy = false,
  lastSavedAt = null,
} = defineProps<{
  nextLabel: string
  canGoBack?: boolean
  isNextDisabled?: boolean
  isBusy?: boolean
  lastSavedAt?: number | null
}>()

const emit = defineEmits<{
  back: []
  next: []
}>()

// Silent until something has actually been written: an untouched step 1 has no
// draft, and being trusted about that is what this line is for.
const savedLabel = computed(() => {
  if (!lastSavedAt) { return '' }
  const time = formatSavedAtTime(lastSavedAt, locale.value)
  return `${$t('publish_wizard.draft_saved')} · ${$t('status_page.last_saved_at', { time })}`
})
</script>
