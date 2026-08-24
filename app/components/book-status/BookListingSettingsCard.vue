<template>
  <UCard :ui="{ body: 'p-4' }">
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('nft_book_form.sale_settings')"
      />
    </template>

    <BookSettingsFields
      v-model:is-adult-only="isAdultOnly"
      v-model:hide-audio="hideAudio"
      v-model:is-preview-enabled="isPreviewEnabled"
      v-model:preview-percentage="previewPercentage"
    />
  </UCard>
</template>

<script setup lang="ts">
import type { BookListingSettingsContext } from '~/composables/useBookListingSettings'

const { t: $t } = useI18n()

const { settings } = defineProps<{
  // Page-owned instance; the pending-changes bar saves it, this only edits it.
  settings: BookListingSettingsContext
}>()

// The prop never changes identity (one instance per page), so the refs can be
// pulled out once and bound like local state.
const {
  isAdultOnly,
  hideAudio,
  isPreviewEnabled,
  previewPercentage,
} = settings
</script>
