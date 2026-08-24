<template>
  <UCard>
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('upload_form.drm_section_title')"
      />
    </template>
    <PublishFileProtectionField
      v-model="isEncrypted"
      :disabled="!editable"
    />
    <p
      class="mt-3 text-xs text-muted"
      v-text="editable
        ? $t('upload_form.drm_section_description')
        : $t('status_page.protection_follows_file_note')"
    />
  </UCard>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

// Read-only on a published book because it is not a separate choice there: it
// follows whatever the file was uploaded as, so replacing the file is what
// changes it. The wizard, where the file has not been uploaded yet, asks.
const { editable = false } = defineProps<{
  editable?: boolean
}>()

const isEncrypted = defineModel<boolean>({ required: true })
</script>
