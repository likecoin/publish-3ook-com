<template>
  <UCard
    :ui="{
      header: 'flex justify-between items-center',
      body: 'p-4',
    }"
  >
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('status_page.merch_description_title')"
      />
    </template>

    <!-- Read-only for moderators, as 書籍資料 is: they can see the listing they
         moderate, but the save bar belongs to the owner. -->
    <p
      v-if="!canEdit"
      class="text-sm text-gray-700 whitespace-pre-wrap break-words text-left"
      v-text="descriptionFull || '—'"
    />

    <UFormField
      v-else
      :label="$t('common.description')"
      class="text-left"
      :hint="`${(descriptionFull || '').length}/${MAX_DESCRIPTION_FULL_LENGTH}`"
      :help="$t('status_page.merch_description_help')"
    >
      <UTextarea
        v-model="descriptionFull"
        :maxlength="MAX_DESCRIPTION_FULL_LENGTH"
        :rows="10"
        autoresize
      />
    </UFormField>
  </UCard>
</template>

<script setup lang="ts">
import type { BookListingSettingsContext } from '~/composables/useBookListingSettings'
import { MAX_DESCRIPTION_FULL_LENGTH } from '~/constant'

const { t: $t } = useI18n()

const { settings, canEdit = false } = defineProps<{
  // Page-owned instance, so the edit joins the pending-changes bar and 放棄
  // restores it like any other field. The /settings POST it saves through
  // echoes every field back, which is why all tabs share one instance.
  settings: BookListingSettingsContext
  canEdit?: boolean
}>()

// The prop never changes identity (one instance per page), so the ref can be
// pulled out once and bound like local state. The short catalog description is
// on-chain metadata, which a merch item has none of, so only this one is editable.
const { descriptionFull } = settings
</script>
