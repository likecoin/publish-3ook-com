<template>
  <!-- The same bar as the book page's, at the top and present at every step:
       書籍資料 is long enough that a bottom bar puts the way on below the fold. -->
  <div class="sticky top-0 z-20 -mx-2 px-2 py-2 bg-default/95 backdrop-blur">
    <div class="flex items-center justify-between gap-4 rounded-lg border border-default bg-elevated/60 px-3 py-2">
      <p
        v-if="savedLabel"
        class="flex items-center gap-1.5 text-sm text-muted truncate"
      >
        <UIcon
          name="i-heroicons-check-circle"
          class="text-success shrink-0"
        />
        <span v-text="savedLabel" />
      </p>
      <div class="flex items-center gap-2 shrink-0 ml-auto">
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
