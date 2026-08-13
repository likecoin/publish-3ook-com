<template>
  <UCard v-if="items.length">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon
          name="i-heroicons-exclamation-triangle"
          class="text-warning"
        />
        <h3
          class="font-bold font-mono"
          v-text="$t('status_page.todo_title')"
        />
        <UBadge
          color="warning"
          variant="subtle"
          size="sm"
          :label="String(items.length)"
        />
      </div>
    </template>
    <ul class="space-y-1">
      <li
        v-for="item in items"
        :key="item.key"
        class="flex items-baseline justify-between gap-4"
      >
        <span
          class="text-sm text-highlighted"
          v-text="item.label"
        />
        <UButton
          variant="link"
          color="primary"
          size="sm"
          class="shrink-0"
          :label="$t('status_page.todo_fix')"
          @click="emit('goToTab', item.tab)"
        />
      </li>
    </ul>
  </UCard>
</template>

<script setup lang="ts">
import type { BookStatusTab } from '~/types/book'

interface BookTodoItem {
  key: string
  label: string
  tab: BookStatusTab
}

const { t: $t } = useI18n()

const {
  genre = '',
  isbn = '',
  shortDescription = '',
  fullDescription = '',
  pendingNFTCount = 0,
  listedEditionCount = 0,
  editionCount = 0,
} = defineProps<{
  genre?: string
  isbn?: string
  shortDescription?: string
  fullDescription?: string
  pendingNFTCount?: number
  listedEditionCount?: number
  editionCount?: number
}>()

const emit = defineEmits<{ goToTab: [tab: BookStatusTab] }>()

// Everything here is derived from what the page already holds. Whether the
// preview actually cuts needs the EPUB's spine table, which only the upload
// session has, so it is not on this list yet.
const items = computed<BookTodoItem[]>(() => {
  const list: BookTodoItem[] = []
  if (!genre) {
    list.push({ key: 'genre', label: $t('status_page.todo_no_genre'), tab: 'details' })
  }
  if (!isbn) {
    list.push({ key: 'isbn', label: $t('status_page.todo_no_isbn'), tab: 'details' })
  }
  // Two identical blurbs mean the storefront's summary line repeats the whole
  // description; the author almost certainly pasted rather than wrote one.
  if (shortDescription && shortDescription === fullDescription) {
    list.push({ key: 'description', label: $t('status_page.todo_duplicate_description'), tab: 'details' })
  }
  if (pendingNFTCount > 0) {
    list.push({
      key: 'pending-send',
      label: $t('status_page.todo_pending_send', { count: pendingNFTCount }),
      tab: 'sales',
    })
  }
  if (listedEditionCount > 0 && listedEditionCount < editionCount) {
    list.push({
      key: 'mixed-editions',
      label: $t('status_page.todo_mixed_editions', {
        listed: listedEditionCount,
        hidden: editionCount - listedEditionCount,
      }),
      tab: 'pricing',
    })
  }
  return list
})
</script>
