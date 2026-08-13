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
      :model-value="isEncrypted"
      disabled
    />
    <p
      class="mt-3 text-xs text-muted"
      v-text="$t('status_page.files_readonly_note')"
    />
  </UCard>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

// The page already derives this from the saved fingerprints and keeps it in
// sync across a chain save; re-deriving it here would let the card disagree
// with the settings the same save writes.
defineProps<{
  isEncrypted: boolean
}>()
</script>
