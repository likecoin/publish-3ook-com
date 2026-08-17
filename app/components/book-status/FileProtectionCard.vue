<template>
  <!-- Protection tier: read-only here because it is not a separate choice —
       it follows whatever the book file was uploaded as, so 書檔's replacement
       flow is where it changes. It sits with 訂價與銷售 because what a buyer
       may do with the file is a term of the sale, not a property of the list. -->
  <UCard>
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('upload_form.drm_section_title')"
      />
    </template>
    <PublishFileProtectionField
      :model-value="isEncrypted"
      disabled
    />
    <p
      class="mt-3 text-xs text-muted"
      v-text="$t('status_page.protection_follows_file_note')"
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
