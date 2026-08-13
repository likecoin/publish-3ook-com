<template>
  <!-- Protection tier: read-only — it follows the files that were uploaded, so
       without a replacement upload there is nothing to choose here. It sits
       with 訂價與銷售 because what a buyer may do with the file is a term of
       the sale, not a property of the file list. -->
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <h3
          class="font-bold font-mono"
          v-text="$t('upload_form.drm_section_title')"
        />
        <UBadge
          color="neutral"
          variant="subtle"
          size="sm"
          icon="i-heroicons-lock-closed"
          :label="$t('status_page.locked_after_upload')"
        />
      </div>
    </template>
    <PublishFileProtectionField
      v-model="isEncrypted"
      disabled
    />
    <p
      class="mt-3 text-xs text-muted"
      v-text="$t('status_page.files_readonly_note')"
    />
  </UCard>
</template>

<script setup lang="ts">
import { shouldHideDownload } from '~/utils/iscn'

const { t: $t } = useI18n()
const { loadClassMetadataIntoForm } = useNFTClassUpdater()

const { classId } = defineProps<{
  classId: string
}>()

const isEncrypted = ref(true)

// Cached after any other tab loaded it; this card reads, never writes.
watch(() => classId, async () => {
  if (!classId) { return }
  try {
    const loaded = await loadClassMetadataIntoForm(classId)
    if (!loaded) { return }
    isEncrypted.value = shouldHideDownload({
      contentFingerprints: loaded.formData.contentFingerprints.map(f => f.url).filter(Boolean),
    })
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load class metadata for the file protection card:', error)
  }
}, { immediate: true })
</script>
