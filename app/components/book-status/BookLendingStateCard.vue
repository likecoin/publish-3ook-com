<template>
  <!-- Paired with 銷售狀態 above, on purpose: the two are the book's channels,
       and they are independent all the way down. Selling is per-edition
       (isUnlisted); lending is one class-level flag no listing query reads. -->
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <h3
          class="font-bold font-mono"
          v-text="$t('status_page.lending_state_title')"
        />
        <UBadge
          variant="subtle"
          :color="badge.color"
          :label="badge.label"
        />
      </div>
    </template>

    <div class="space-y-4">
      <URadioGroup
        v-model="lendingState"
        :disabled="!canEdit || isFreeBook"
        :items="stateItems"
        orientation="vertical"
        :ui="{ fieldset: 'gap-3' }"
      />

      <!-- The setting is kept; it just reaches nobody meanwhile. -->
      <UAlert
        v-if="isBookUnlisted"
        color="warning"
        variant="subtle"
        icon="i-heroicons-exclamation-triangle"
        :description="$t('status_page.unlisted_pauses_lending_preview')"
      />
      <!-- Independent of the notice above: that one says what readers get, this
           one says why the radio is greyed out, and a free book can need both. -->
      <UAlert
        v-if="isFreeBook"
        color="neutral"
        variant="subtle"
        icon="i-heroicons-information-circle"
        :description="$t('nft_book_form.plus_reading_free_forced')"
      />
      <p
        v-else-if="!isBookUnlisted"
        class="text-sm text-muted"
        v-text="$t('status_page.lending_state_independent_note')"
      />
    </div>
  </UCard>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

const { canEdit = false, isFreeBook = false, isBookUnlisted = false } = defineProps<{
  // Moderators read this page without a save bar; letting them flip the radio
  // would count a change nothing here can save or discard.
  canEdit?: boolean
  isFreeBook?: boolean
  isBookUnlisted?: boolean
}>()

// The page's settings instance, so switching joins the pending-changes bar and
// 放棄 restores it like any other field.
const isPlusReadingEnabled = defineModel<boolean>({ required: true })

// Paused is neither on nor off: the stored choice is unchanged, it just does
// not reach a reader while the book is off the shelf.
const badge = computed(() => {
  if (isBookUnlisted) {
    return { color: 'warning' as const, label: $t('status_page.lending_state_badge_paused') }
  }
  return isPlusReadingEnabled.value
    ? { color: 'success' as const, label: $t('status_page.lending_state_badge_on') }
    : { color: 'neutral' as const, label: $t('status_page.lending_state_badge_off') }
})

const stateItems = computed(() => [
  {
    value: 'listed',
    label: $t('status_page.lending_state_on'),
    description: $t('status_page.lending_state_on_hint'),
  },
  {
    value: 'unlisted',
    label: $t('status_page.lending_state_off'),
    description: $t('status_page.lending_state_off_hint'),
  },
])

const lendingState = computed({
  get: () => (isPlusReadingEnabled.value ? 'listed' : 'unlisted'),
  set: (value: string) => { isPlusReadingEnabled.value = value === 'listed' },
})
</script>
