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
  pendingNFTCount = 0,
  hasStoreMetadataMismatch = false,
} = defineProps<{
  genre?: string
  isbn?: string
  pendingNFTCount?: number
  // The bookstore listing holds metadata that disagrees with the chain, which
  // only the owner can resolve — see utils/store-metadata-drift.ts.
  hasStoreMetadataMismatch?: boolean
}>()

const emit = defineEmits<{ goToTab: [tab: BookStatusTab] }>()

// Everything here is derived from what the page already holds. Two candidates
// are deliberately absent: whether the preview cuts needs the EPUB's spine
// table, which only the upload session has, and 版本不一致 is stated by the
// sale-state card above, beside the control that resolves it.
//
// 短簡介與簡介相同 is gone for good: it is what deriving the catalog line
// produces whenever the description fits under the cap, so it flags the
// intended default rather than a mistake.
const items = computed<BookTodoItem[]>(() => {
  const list: BookTodoItem[] = []
  if (!genre) {
    list.push({ key: 'genre', label: $t('status_page.todo_no_genre'), tab: 'details' })
  }
  if (!isbn) {
    list.push({ key: 'isbn', label: $t('status_page.todo_no_isbn'), tab: 'details' })
  }
  if (hasStoreMetadataMismatch) {
    list.push({
      key: 'store-metadata',
      label: $t('status_page.todo_store_metadata_mismatch'),
      tab: 'details',
    })
  }
  if (pendingNFTCount > 0) {
    list.push({
      key: 'pending-send',
      label: $t('status_page.todo_pending_send', { count: pendingNFTCount }),
      tab: 'sales',
    })
  }
  return list
})
</script>
