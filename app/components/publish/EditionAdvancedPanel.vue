<template>
  <!-- Wraps the fields an author rarely revisits. Collapsed only where the
       page has demoted editions to a single price; everywhere else the same
       slot renders flat, so there is one copy of the markup either way. -->
  <UCollapsible
    v-if="collapsible"
    v-model:open="isOpen"
    class="w-full"
  >
    <UButton
      variant="link"
      color="neutral"
      size="sm"
      class="px-0"
      :label="$t('nft_book_form.advanced_edition_settings')"
      :trailing-icon="isOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
    />
    <template #content>
      <div class="flex flex-col gap-[20px] pt-4">
        <slot />
      </div>
    </template>
  </UCollapsible>
  <template v-else>
    <slot />
  </template>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

const { collapsible = false } = defineProps<{
  collapsible?: boolean
}>()

const isOpen = ref(false)
</script>
