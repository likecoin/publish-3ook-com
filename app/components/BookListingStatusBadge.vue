<template>
  <div
    class="inline-flex items-center gap-1.5 whitespace-nowrap"
    :class="display.class"
  >
    <UIcon
      :name="display.icon"
      size="18"
    />
    <span v-text="display.label" />
  </div>
</template>

<script setup lang="ts">
import type { BookListingStatus } from '~/types'

const { status } = defineProps<{ status: BookListingStatus }>()

const { t: $t } = useI18n()

const display = computed(() => {
  switch (status) {
    case 'listed':
      return {
        icon: 'i-heroicons-check-circle',
        class: 'text-primary-600 dark:text-primary-400',
        label: $t('my_books.status_listed'),
      }
    case 'draft':
      return {
        icon: 'i-heroicons-pencil-square',
        class: 'text-gray-500 dark:text-gray-400',
        label: $t('my_books.status_draft'),
      }
    case 'pending_review':
      return {
        icon: 'i-heroicons-clock',
        class: 'text-gray-500 dark:text-gray-400',
        label: $t('my_books.status_pending_review'),
      }
    default:
      return {
        icon: 'i-heroicons-minus-circle',
        class: 'text-amber-600 dark:text-amber-500',
        label: $t('my_books.status_unlisted'),
      }
  }
})
</script>
