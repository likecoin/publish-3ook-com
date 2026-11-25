<template>
  <UCard :ui="{ body: 'p-4 sm:p-4 flex flex-col gap-3' }">
    <div class="flex flex-col gap-0.5">
      <div
        class="text-highlighted font-semibold"
        v-text="$t('nft_book_form.restricted_territories')"
      />
      <div
        class="text-sm text-muted"
        v-text="$t('nft_book_form.restricted_territories_hint')"
      />
    </div>

    <USelectMenu
      v-model="model"
      class="w-full"
      value-key="value"
      multiple
      :items="territoryOptions"
      :disabled="locked"
      :placeholder="$t('nft_book_form.restricted_territories_none')"
      :search-input="{ placeholder: $t('nft_book_form.restricted_territories_search') }"
      :aria-label="$t('nft_book_form.restricted_territories')"
    />

    <UAlert
      v-if="locked"
      color="neutral"
      variant="subtle"
      icon="i-heroicons-lock-closed"
      :description="$t('nft_book_form.restricted_territories_locked')"
    />
  </UCard>
</template>

<script setup lang="ts">
const model = defineModel<string[]>({ required: true })

const { locked = false } = defineProps<{
  // Set by compliance review or an admin, which the API refuses to let the publisher change.
  locked?: boolean
}>()

const { t: $t, localeProperties } = useI18n()

const territoryOptions = computed(() => getTerritoryOptions(localeProperties.value.language || 'zh-TW'))
</script>
