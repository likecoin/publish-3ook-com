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

// Keyed by status rather than switched on, so a new one cannot quietly fall
// through to another status's label — the record has to name it or fail to type.
const statusDisplay = computed<Record<BookListingStatus, { icon: string, class: string, label: string }>>(() => ({
  listed: {
    icon: 'i-heroicons-check-circle',
    class: 'text-primary-600 dark:text-primary-400',
    label: $t('my_books.status_listed'),
  },
  sold_out: {
    icon: 'i-heroicons-archive-box-x-mark',
    class: 'text-rose-600 dark:text-rose-400',
    label: $t('my_books.status_sold_out'),
  },
  draft: {
    icon: 'i-heroicons-pencil-square',
    class: 'text-gray-500 dark:text-gray-400',
    label: $t('my_books.status_draft'),
  },
  pending_review: {
    icon: 'i-heroicons-clock',
    class: 'text-gray-500 dark:text-gray-400',
    label: $t('my_books.status_pending_review'),
  },
  unlisted: {
    icon: 'i-heroicons-minus-circle',
    class: 'text-amber-600 dark:text-amber-500',
    label: $t('my_books.status_unlisted'),
  },
}))

const display = computed(() => statusDisplay.value[status])
</script>
