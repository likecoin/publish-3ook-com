export interface PaginatedTableSort {
  column: string | null
  direction: 'asc' | 'desc' | null
}

// Type-aware ascending comparison used when no custom comparator is given.
export function compareTableValues(aValue: unknown, bValue: unknown): number {
  if (typeof aValue === 'string' && typeof bValue === 'string') {
    return aValue.localeCompare(bValue)
  }
  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return aValue - bValue
  }
  if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
    return (aValue ? 1 : 0) - (bValue ? 1 : 0)
  }
  if (aValue == null && bValue == null) {
    return 0
  }
  if (aValue == null) {
    return -1
  }
  if (bValue == null) {
    return 1
  }
  return String(aValue).localeCompare(String(bValue))
}

interface UsePaginatedTableOptions<T> {
  // Source rows, already filtered by the host.
  rows: Ref<T[]> | ComputedRef<T[]>
  pageSize?: number
  initialSort?: PaginatedTableSort
  // Ascending comparator for the active sort column's cell values.
  compare?: (aValue: unknown, bValue: unknown, column: string) => number
  // Ordering applied when no sort column is active.
  defaultCompare?: (a: T, b: T) => number
}

// Client-side sort + pagination state shared by row-table pages.
export function usePaginatedTable<T>(options: UsePaginatedTableOptions<T>) {
  const pagination = ref({
    page: 1,
    limit: options.pageSize ?? 50,
    total: 0,
  })

  const sortState = ref<PaginatedTableSort>({
    column: null,
    direction: null,
    ...options.initialSort,
  })

  const pageSizeOptions = [
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
    { label: '200', value: 200 },
  ]

  const sortedRows = computed(() => {
    const rows = [...options.rows.value]
    const { column, direction } = sortState.value

    if (!column || !direction) {
      return options.defaultCompare ? rows.sort(options.defaultCompare) : rows
    }

    const compare = options.compare ?? compareTableValues
    return rows.sort((a, b) => {
      const comparison = compare(
        (a as Record<string, unknown>)[column],
        (b as Record<string, unknown>)[column],
        column,
      )
      return direction === 'desc' ? -comparison : comparison
    })
  })

  const paginatedRows = computed(() => {
    const start = (pagination.value.page - 1) * pagination.value.limit
    return sortedRows.value.slice(start, start + pagination.value.limit)
  })

  const totalPages = computed(() => {
    return Math.ceil(pagination.value.total / pagination.value.limit)
  })

  // Keep the page in range when the source rows shrink (filtering, refetch).
  watch(() => options.rows.value.length, (total) => {
    pagination.value.total = total
    pagination.value.page = Math.max(1, Math.min(pagination.value.page, totalPages.value))
  }, { immediate: true })

  function setSortState(column: string | null, direction: 'asc' | 'desc' | null) {
    sortState.value.column = column
    sortState.value.direction = direction
  }

  function setPage(page: number) {
    pagination.value.page = Math.max(1, Math.min(page, totalPages.value))
  }

  function setPageSize(limit: number) {
    pagination.value.limit = limit
    pagination.value.page = 1 // Reset to first page
  }

  function getSortIcon(columnKey: string) {
    if (sortState.value.column === columnKey) {
      return sortState.value.direction === 'asc'
        ? 'i-heroicons-bars-arrow-up-20-solid'
        : 'i-heroicons-bars-arrow-down-20-solid'
    }
    return 'i-heroicons-arrows-up-down-20-solid'
  }

  return {
    pagination: readonly(pagination),
    sortState: readonly(sortState),
    pageSizeOptions,
    sortedRows,
    paginatedRows,
    totalPages,
    setSortState,
    setPage,
    setPageSize,
    getSortIcon,
  }
}
