<template>
  <!-- Sticky at the top of the page, and present even when clean: testers who
       edited a long tab never scrolled far enough to find a bottom bar, and a
       bar that only appears once you are dirty cannot tell you you are saved. -->
  <div class="sticky top-0 z-20 -mx-2 px-2 py-2 bg-default/95 backdrop-blur">
    <div
      class="flex items-center justify-between gap-4 rounded-lg border px-3 py-2"
      :class="isDirty ? 'border-primary/40 bg-elevated/95 shadow-sm' : 'border-default bg-elevated/60'"
    >
      <div class="flex items-center gap-3 min-w-0">
        <template v-if="isDirty">
          <UDropdownMenu :items="dropdownItems">
            <UButton
              variant="soft"
              color="primary"
              size="sm"
              :label="$t('status_page.pending_changes_count', { count: changes.length })"
              trailing-icon="i-heroicons-chevron-down"
            />
          </UDropdownMenu>
          <div class="hidden sm:block min-w-0">
            <p
              class="text-xs text-muted truncate"
              v-text="audienceLabel"
            />
            <p
              v-if="needsWalletSignature"
              class="text-xs text-muted truncate"
              v-text="$t('status_page.wallet_signature_hint')"
            />
          </div>
        </template>
        <p
          v-else
          class="flex items-center gap-1.5 text-sm text-muted truncate"
        >
          <UIcon
            name="i-heroicons-check-circle"
            class="text-success shrink-0"
          />
          <span v-text="savedLabel" />
        </p>
      </div>
      <div
        v-if="isDirty"
        class="flex items-center gap-2 shrink-0"
      >
        <UButton
          variant="link"
          color="neutral"
          :label="$t('status_page.discard_changes')"
          :disabled="isSaving"
          @click="emit('discard')"
        />
        <UButton
          :label="$t('status_page.save_changes')"
          :loading="isSaving"
          :disabled="isSaving"
          @click="emit('save')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '#ui/types'
import type { BookEditChangeAudience, BookEditChangeEntry } from '~/composables/useBookEditChanges'

const { t: $t, locale } = useI18n()

const {
  changes,
  audience = null,
  buyerCount = 0,
  needsWalletSignature = false,
  isSaving = false,
  lastSavedAt = null,
} = defineProps<{
  changes: BookEditChangeEntry[]
  audience?: BookEditChangeAudience | null
  buyerCount?: number
  needsWalletSignature?: boolean
  isSaving?: boolean
  lastSavedAt?: number | null
}>()

const emit = defineEmits<{
  save: []
  discard: []
  jump: [tab: BookEditChangeEntry['tab']]
}>()

const isDirty = computed(() => changes.length > 0)

// Says who the save reaches, so the author does not have to infer it from the
// field names. Counting nobody is worth saying out loud on a book with no sales.
const audienceLabel = computed(() => {
  switch (audience) {
    case 'readers':
      return buyerCount > 0
        ? $t('status_page.changes_audience_readers', { count: buyerCount })
        : $t('status_page.changes_audience_readers_none')
    case 'future_purchases':
      return $t('status_page.changes_audience_future')
    default:
      return $t('status_page.changes_audience_storefront')
  }
})

// Only this visit's saves have a time to show; on a fresh load the clean state
// says so without claiming a timestamp it does not have.
const savedLabel = computed(() => {
  if (!lastSavedAt) { return $t('status_page.all_changes_saved') }
  const time = new Date(lastSavedAt).toLocaleTimeString(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${$t('status_page.all_changes_saved')} · ${$t('status_page.last_saved_at', { time })}`
})

// Each entry jumps to the tab that owns the field; the wallet icon marks the
// ones whose save will ask for a signature.
const dropdownItems = computed<DropdownMenuItem[]>(() => changes.map(entry => ({
  label: entry.label,
  icon: entry.needsWallet ? 'i-heroicons-wallet' : undefined,
  onSelect: () => emit('jump', entry.tab),
})))
</script>
