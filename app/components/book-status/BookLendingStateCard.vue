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
          :color="isPlusReadingEnabled ? 'success' : 'neutral'"
          :label="isPlusReadingEnabled
            ? $t('status_page.lending_state_badge_on')
            : $t('status_page.lending_state_badge_off')"
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

      <!-- A free book is always in the library, so the control is greyed out
           rather than absent: the state is still worth reading. -->
      <UAlert
        v-if="isFreeBook"
        color="neutral"
        variant="subtle"
        icon="i-heroicons-information-circle"
        :description="$t('nft_book_form.plus_reading_free_forced')"
      />
      <p
        v-else
        class="text-sm text-muted"
        v-text="$t('status_page.lending_state_independent_note')"
      />
    </div>
  </UCard>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

const { canEdit = false, isFreeBook = false } = defineProps<{
  // Moderators read this page without a save bar; letting them flip the radio
  // would count a change nothing here can save or discard.
  canEdit?: boolean
  isFreeBook?: boolean
}>()

// The page's settings instance, so switching joins the pending-changes bar and
// 放棄 restores it like any other field.
const isPlusReadingEnabled = defineModel<boolean>({ required: true })

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
