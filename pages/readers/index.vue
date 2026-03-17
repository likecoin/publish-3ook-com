<template>
  <PageBody class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-lg font-bold font-mono" v-text="$t('menu.readers_list')" />
      <div class="flex gap-2">
        <UButton
          icon="i-hugeicons-csv-02"
          color="primary"
          variant="outline"
          @click="exportSelectedToCSV"
        >
          {{ $t('common.export_csv',{ length: hasSelection ? selectionCount : ordersStore.readers.length }) }}
        </UButton>
        <UButton
          icon="i-heroicons-arrow-path"
          variant="outline"
          color="neutral"
          :disabled="ordersStore.isLoading"
          :loading="ordersStore.isLoading"
          @click="refreshData"
        />
      </div>
    </div>

    <UAlert
      v-if="ordersStore.error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="ordersStore.error"
      :close="{ icon: 'i-heroicons-x-mark-20-solid', color: 'error', variant: 'link' }"
      @close="ordersStore.clearError()"
    />

    <UCard :ui="{ body: 'p-0!' }">
      <template #header>
        <div class="flex justify-between items-center">
          <h3 class="font-medium" v-text="$t('readers.total_readers', { count: ordersStore.isLoading ? '...' : ordersStore.readers.length })" />
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500" v-text="$t('common.page_size')" />
            <USelect
              v-model="pageSize"
              :items="pageSizeOptions"
              size="sm"
              @update:model-value="onPageSizeChange"
            />
          </div>
        </div>
      </template>

      <UTable
        :model-value="selectedRows"
        :data="paginatedReaders"
        :columns="columns"
        :loading="ordersStore.isLoading"
        :progress="{ color: 'primary', animation: 'carousel' }"
        :ui="{
          th: 'text-left text-nowrap whitespace-nowrap',
          td: 'text-right',
          tr: 'cursor-default [&>td]:pointer-events-none [&>td>*]:pointer-events-auto [&>td>input]:pointer-events-auto hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors duration-200',
        }"
        @update:model-value="onSelect"
      >
        <!-- headers -->
        <template
          v-for="column in baseColumnsConfig"
          :key="`header-${column.key}`"
          #[`${column.key}-header`]
        >
          <UButton
            v-if="column.key !== 'lifetimeValue'"
            color="neutral"
            variant="ghost"
            :label="column.label"
            :trailing-icon="getSortIcon(sortState.column, sortState.direction, column.key)"
            @click="() => sortByColumn(column.key)"
          />
          <UTooltip v-else text="USD">
            <UButton
              color="neutral"
              variant="ghost"
              :label="column.label"
              :trailing-icon="getSortIcon(sortState.column, sortState.direction, column.key)"
              @click="() => sortByColumn(column.key)"
            />
          </UTooltip>
        </template>
        <template
          v-for="book in Object.values(ordersStore.booksInfo)"
          :key="`header-${book.classId}`"
          #[`book_${book.classId}-header`]
        >
          <UTooltip :text="book.name || book.classId" class="cursor-help">
            <UButton
              color="neutral"
              variant="ghost"
              :label="book.name?.slice(0, 1) || book.classId.slice(0, 1)"
              :trailing-icon="getSortIcon(sortState.column, sortState.direction, `book_${book.classId}`)"
              @click="() => sortByColumn(`book_${book.classId}`)"
            />
          </UTooltip>
        </template>

        <!-- rows -->
        <template #readerEmail-cell="{ row }">
          <div class="w-full flex justify-start">
            <UButton
              :label="row.original.readerEmail"
              variant="link"
              size="sm"
              @click.stop="openMailto(row.original.readerEmail)"
            />
          </div>
        </template>

        <template #readerWallet-cell="{ row }">
          <UButton
            v-if="row.original.readerWallet"
            class="font-mono"
            :label="shortenWallet(row.original.readerWallet)"
            variant="link"
            size="sm"
            @click.stop="openWalletLink(row.original.readerWallet)"
          />
          <span v-else class="text-gray-400">-</span>
        </template>

        <template #firstPurchaseTime-cell="{ row }">
          <span class="text-sm" v-text="formatDate(row.original.firstPurchaseTime)" />
        </template>

        <template #lastPurchaseTime-cell="{ row }">
          <span class="text-sm" v-text="formatDate(row.original.lastPurchaseTime)" />
        </template>

        <template #lifetimeValue-cell="{ row }">
          <span class="font-medium" v-text="`$${formatValue(row.original.lifetimeValue)}`" />
        </template>

        <template #hasMessage-cell="{ row }">
          <div class="flex justify-center w-full">
            <UBadge
              :color="row.original.hasMessage ? 'success' : 'neutral'"
              :label="row.original.hasMessage ? 'Y' : 'N'"
              variant="soft"
            />
          </div>
        </template>
        <template
          v-for="book in Object.values(ordersStore.booksInfo)"
          :key="`template-${book.classId}`"
          #[`book_${book.classId}-cell`]="{ row }"
        >
          <div class="flex justify-center w-full">
            <UBadge
              :color="(row.original as Record<string, unknown>)[`book_${book.classId}`] ? 'success' : 'neutral'"
              :label="(row.original as Record<string, unknown>)[`book_${book.classId}`] ? 'Y' : 'N'"
              variant="soft"
            />
          </div>
        </template>
      </UTable>

      <template #footer>
        <div class="flex justify-end items-center">
          <UPagination
            v-model:page="currentPage"
            :page-count="pagination.limit"
            :total="ordersStore.readers.length"
            :max="7"
            show-last
            show-first
          />
        </div>
      </template>
    </UCard>
  </PageBody>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

const bookstoreApiStore = useBookstoreApiStore()

const {
  ordersStore,
  paginatedReaders,
  columns,
  pagination,
  sortState,
  selectedRows,
  hasSelection,
  selectionCount,
  setSortState,
  setPage,
  setPageSize,
  onSelect,
  clearSelection,
  formatDate,
  formatCurrency: formatValue,
  shortenWallet,
  getWalletLink,
  getSortIcon,
  baseColumnsConfig,
  pageSizeOptions,
  exportReadersToCSV
} = useReadersTable()

const pageSize = ref(100)
const currentPage = ref(1)

watch(currentPage, (newPage: number) => {
  setPage(newPage)
})

onMounted(async () => {
  if (bookstoreApiStore.isAuthenticated) {
    await loadReadersData()
  }
})

async function loadReadersData () {
  await ordersStore.fetchReaders()
}

async function refreshData () {
  await ordersStore.fetchReaders(true)
  clearSelection()
}

function onPageSizeChange (newSize: number) {
  setPageSize(newSize)
  currentPage.value = 1
}

function sortByColumn (columnKey: string) {
  const currentSort = sortState.value

  if (currentSort.column === columnKey) {
    if (currentSort.direction === 'asc') {
      setSortState(columnKey, 'desc')
    } else if (currentSort.direction === 'desc') {
      setSortState(null, null)
    } else {
      setSortState(columnKey, 'asc')
    }
  } else {
    setSortState(columnKey, 'asc')
  }
}

function exportSelectedToCSV () {
  useLogEvent('readers_export_csv')
  exportReadersToCSV()
}

function openMailto (email: string) {
  window.open(`mailto:${email}`, '_self')
}

function openWalletLink (wallet: string) {
  window.open(getWalletLink(wallet), '_blank')
}
</script>
