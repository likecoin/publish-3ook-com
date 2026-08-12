<template>
  <div class="flex flex-wrap items-center gap-2">
    <span
      class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap"
      v-text="$t('table.rows_per_page')"
    />
    <USelect
      v-model="pageSize"
      class="w-20"
      size="sm"
      :items="pageSizeOptions"
      :aria-label="$t('table.rows_per_page')"
    />
    <span
      class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap"
      v-text="$t('table.page_range', { from: rowFrom, to: rowTo, total })"
    />
    <UPagination
      v-model:page="page"
      size="sm"
      :items-per-page="pageSize"
      :total="total"
      show-first
      show-last
    />
  </div>
</template>

<script setup lang="ts">
const page = defineModel<number>('page', { required: true })
const pageSize = defineModel<number>('pageSize', { required: true })

defineProps<{
  total: number
  rowFrom: number
  rowTo: number
  pageSizeOptions: { label: string, value: number }[]
}>()
</script>
