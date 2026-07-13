<template>
  <UFormField :label="$t('form.table_of_content')">
    <UTextarea
      v-model="modelValue"
      :rows="8"
      placeholder="- Chapter 1&#10;- Chapter 2&#10;  - Section 2.1"
    />
  </UFormField>
</template>

<script setup lang="ts">
// Listing-owned but reads as book metadata, so both hosts render it alongside
// the book details rather than with the sale settings.
const modelValue = defineModel<string>()

const { t: $t } = useI18n()
</script>
