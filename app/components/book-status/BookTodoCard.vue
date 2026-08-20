<template>
  <UCard v-if="visibleItems.length">
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
          :label="String(visibleItems.length)"
        />
      </div>
    </template>
    <ul class="space-y-1">
      <li
        v-for="item in visibleItems"
        :key="item.key"
        class="flex items-baseline justify-between gap-4"
      >
        <span
          class="text-sm text-highlighted"
          v-text="item.label"
        />
        <div class="flex items-center gap-1 shrink-0">
          <UButton
            variant="link"
            color="primary"
            size="sm"
            :label="$t('status_page.todo_fix')"
            @click="emit('goToTab', item.tab)"
          />
          <UButton
            v-if="isDismissible(item.key)"
            variant="link"
            color="neutral"
            size="sm"
            icon="i-heroicons-x-mark"
            :aria-label="$t('status_page.todo_dismiss')"
            @click="dismiss(item.key)"
          />
        </div>
      </li>
    </ul>
  </UCard>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import type { BookStatusTab } from '~/types/book'

// Also the persisted dismissal format, so a rename has to be a deliberate one.
type BookTodoKey = 'genre' | 'isbn' | 'store-metadata' | 'pending-send'

interface BookTodoItem {
  key: BookTodoKey
  label: string
  tab: BookStatusTab
}

// Genre and ISBN are advice, not work: a book can ship without either, so an
// author who has decided against one can put the nudge away for good. The rest
// is outstanding work and stays until it is resolved.
const DISMISSIBLE_TODO_KEYS: ReadonlySet<BookTodoKey> = new Set(['genre', 'isbn'])

const { t: $t } = useI18n()

const {
  classId,
  genre = '',
  isbn = '',
  pendingNFTCount = 0,
  hasStoreMetadataMismatch = false,
} = defineProps<{
  classId: string
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
// 短簡介與描述相同 is gone for good: it is what deriving the catalog line
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

// Per book: skipping the ISBN on one title says nothing about the next.
const dismissedKeys = useLocalStorage<BookTodoKey[]>(
  () => `publish_book_todo_dismissed:${classId}`, [])

function isDismissible(key: BookTodoKey) {
  return DISMISSIBLE_TODO_KEYS.has(key)
}

function dismiss(key: BookTodoKey) {
  dismissedKeys.value = [...dismissedKeys.value, key]
}

// The dismissible check also keeps a stale stored key from ever suppressing an
// entry that has since stopped being advice.
const visibleItems = computed(() => items.value
  .filter(item => !(isDismissible(item.key) && dismissedKeys.value.includes(item.key))))
</script>
