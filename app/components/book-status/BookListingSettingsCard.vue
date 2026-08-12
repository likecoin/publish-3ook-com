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
        v-text="$t('nft_book_form.sale_settings')"
      />
      <UButton
        :label="$t('common.save')"
        :loading="isSaving"
        :disabled="isSaving"
        @click="handleSave"
      />
    </template>

    <BookSettingsFields
      v-model:is-adult-only="isAdultOnly"
      v-model:hide-audio="hideAudio"
      v-model:is-plus-reading-enabled="isPlusReadingEnabled"
      v-model:is-preview-enabled="isPreviewEnabled"
      v-model:preview-percentage="previewPercentage"
      :is-free-book="isFreeBook"
    />
  </UCard>
</template>

<script setup lang="ts">
import type { BookListingSettingsContext } from '~/composables/useBookListingSettings'

const { t: $t } = useI18n()
const { showSuccessToast, showInfoToast, showErrorToast } = useToastComposable()
const { updateBookListingSetting } = useBookstoreApiStore()

const { classId, settings, isFreeBook } = defineProps<{
  classId: string
  settings: BookListingSettingsContext
  isFreeBook: boolean
}>()

const emit = defineEmits<{ saved: [] }>()

// The prop never changes identity (one instance per page), so the refs can be
// pulled out once and bound like local state.
const {
  isAdultOnly,
  hideAudio,
  isPlusReadingEnabled,
  isPreviewEnabled,
  previewPercentage,
  isListingSettingsDirty,
  commitListingSnapshot,
  buildSettingsPayload,
} = settings

const isSaving = ref(false)

async function handleSave() {
  try {
    isSaving.value = true
    if (!isListingSettingsDirty()) {
      showInfoToast($t('status_page.no_changes'))
      return
    }
    await updateBookListingSetting(classId, buildSettingsPayload())
    commitListingSnapshot()
    showSuccessToast($t('status_page.settings_saved'))
    emit('saved')
  }
  catch (err) {
    const errorData = (err as { data?: string }).data || err
    // eslint-disable-next-line no-console
    console.error(errorData)
    showErrorToast(String(errorData), { duration: 5000 })
  }
  finally {
    isSaving.value = false
  }
}
</script>
