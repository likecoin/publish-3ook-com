<template>
  <!-- The same bar as the book page's, at the top and present at every step:
       書籍資料 is long enough that a bottom bar puts the way on below the fold,
       which is the finding that moved the other one up here. It also says the
       draft is saved, which the wizard was doing silently. -->
  <div class="sticky top-0 z-20 -mx-2 px-2 py-2 bg-default/95 backdrop-blur">
    <div class="flex items-center justify-between gap-4 rounded-lg border border-default bg-elevated/60 px-3 py-2">
      <p class="flex items-center gap-1.5 text-sm text-muted truncate">
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

// Only this visit's saves have a time to show; before the first one the line
// still says the draft is kept, without claiming a timestamp it does not have.
const savedLabel = computed(() => {
  if (!lastSavedAt) { return $t('publish_wizard.draft_saved') }
  const time = new Date(lastSavedAt).toLocaleTimeString(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${$t('publish_wizard.draft_saved')} · ${$t('status_page.last_saved_at', { time })}`
})
</script>
