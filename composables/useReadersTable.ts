import { useOrdersStore } from '~/stores/orders'
import { downloadCSV } from '~/utils/index'

export function useReadersTable () {
  const { t } = useI18n()

  const ordersStore = useOrdersStore()

  const pagination = ref({
    page: 1,
    limit: 100,
    total: 0
  })

  const sortState = ref<{
    column: string | null
    direction: 'asc' | 'desc' | null
  }>({
    column: null,
    direction: null
  })

  const pageSizeOptions = [
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
    { label: '200', value: 200 }
  ]

  const selectedRows = ref<any[]>([])
  const hasSelection = computed(() => selectedRows.value.length > 0)
  const selectionCount = computed(() => selectedRows.value.length)

  const baseColumnsConfig = computed(() => [
    { key: 'readerEmail', label: t('table.reader_email') },
    { key: 'readerWallet', label: t('table.reader_wallet') },
    { key: 'firstPurchaseTime', label: t('table.first_purchase') },
    { key: 'lastPurchaseTime', label: t('table.last_purchase') },
    { key: 'lifetimeValue', label: t('table.lifetime_value') },
    { key: 'hasMessage', label: t('table.has_message') }
  ])

  const columns = computed(() => {
    const baseColumns = baseColumnsConfig.value.map(col => ({
      key: col.key,
      label: col.label,
      sortable: true
    }))

    const bookColumns = Object.values(ordersStore.booksInfo).map((book: any) => ({
      key: `book_${book.classId}`,
      label: book.name?.slice(0, 1) || book.classId.slice(0, 1),
      sortable: true
    }))

    return [...baseColumns, ...bookColumns]
  })

  const sortedReaders = computed(() => {
    const readers = [...ordersStore.readers]

    if (!sortState.value.column || !sortState.value.direction) {
      return readers.sort((a, b) => b.lifetimeValue - a.lifetimeValue)
    }

    return readers.sort((a, b) => {
      const aValue = a[sortState.value.column!]
      const bValue = b[sortState.value.column!]

      let comparison = 0

      if (sortState.value.column!.includes('Time')) {
        const aTime = new Date(aValue).getTime()
        const bTime = new Date(bValue).getTime()
        comparison = aTime - bTime
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue)
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        comparison = (aValue ? 1 : 0) - (bValue ? 1 : 0)
      } else if (aValue == null && bValue == null) {
        comparison = 0
      } else if (aValue == null) {
        comparison = -1
      } else if (bValue == null) {
        comparison = 1
      } else {
        comparison = String(aValue).localeCompare(String(bValue))
      }

      return sortState.value.direction === 'desc' ? -comparison : comparison
    })
  })

  const paginatedReaders = computed(() => {
    pagination.value.total = ordersStore.readers.length

    const start = (pagination.value.page - 1) * pagination.value.limit
    const end = start + pagination.value.limit
    return sortedReaders.value.slice(start, end)
  })

  const totalPages = computed(() => {
    return Math.ceil(pagination.value.total / pagination.value.limit)
  })

  function onSelect (rows: any[]) {
    selectedRows.value = rows
  }

  function clearSelection () {
    selectedRows.value = []
  }

  function formatDate (dateString: string | number, locale = 'zh-TW'): string {
    if (!dateString) { return '-' }

    const date = new Date(dateString)
    if (isNaN(date.getTime())) { return '-' }

    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  function formatValue (amount: number, decimals = 2): string {
    if (typeof amount !== 'number' || isNaN(amount)) { return '0.00' }
    return `${amount.toFixed(decimals)}`
  }

  function setSortState (column: string | null, direction: 'asc' | 'desc' | null) {
    sortState.value.column = column
    sortState.value.direction = direction
  }

  function setPage (page: number) {
    const maxPage = Math.ceil(pagination.value.total / pagination.value.limit)
    pagination.value.page = Math.max(1, Math.min(page, maxPage))
  }

  function setPageSize (limit: number) {
    pagination.value.limit = limit
    pagination.value.page = 1 // Reset to first page
  }

  function shortenWallet (wallet: string, startLength = 6, endLength = 4): string {
    if (!wallet) { return '' }
    if (wallet.length <= startLength + endLength) { return wallet }

    return `${wallet.slice(0, startLength)}...${wallet.slice(-endLength)}`
  }

  function getWalletLink (wallet: string): string {
    if (!wallet) { return '' }
    return `https://opensea.io/${wallet}`
  }

  function getSortIcon (currentColumn: string | null, currentDirection: 'asc' | 'desc' | null, columnKey: string) {
    if (currentColumn === columnKey) {
      return currentDirection === 'asc'
        ? 'i-heroicons-bars-arrow-up-20-solid'
        : 'i-heroicons-bars-arrow-down-20-solid'
    }
    return 'i-heroicons-arrows-up-down-20-solid'
  }

  function getNestedValue (obj: any, path: string) {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  async function exportToCSV (
    data: any[],
    columnConfig: { key: string; label: string; formatter?: (value: any) => string }[],
    filename?: string
  ) {
    if (data.length === 0) {
      return
    }

    // Pre-process data with formatters and nested properties
    const processedData = data.map((row) => {
      const result: Record<string, any> = {}
      columnConfig.forEach((col) => {
        const value = getNestedValue(row, col.key)
        result[col.label] = col.formatter ? col.formatter(value) : value
      })
      return result
    })

    // Use column labels as keys for the utility
    const columns = columnConfig.map(col => ({ key: col.label, label: col.label }))
    const finalFilename = filename || `export_${new Date().toISOString().split('T')[0]}.csv`

    await downloadCSV(processedData, columns, finalFilename)
  }

  async function exportReadersToCSV () {
    if (!hasSelection.value) { return }

    const columnConfig = [
      { key: 'readerEmail', label: t('table.reader_email') },
      { key: 'readerWallet', label: t('table.reader_wallet') },
      { key: 'firstPurchaseTime', label: t('table.first_purchase'), formatter: formatDate },
      { key: 'lastPurchaseTime', label: t('table.last_purchase'), formatter: formatDate },
      { key: 'lifetimeValue', label: `${t('table.lifetime_value')} (USD)`, formatter: (val: number) => formatValue(val) },
      { key: 'hasMessage', label: t('table.has_message'), formatter: (val: boolean) => val ? 'Y' : 'N' },
      ...Object.values(ordersStore.booksInfo).map((book: any) => ({
        key: `purchasedBooks.${book.classId}`,
        label: book.name || book.classId,
        formatter: (val: boolean) => val ? 'Y' : 'N'
      }))
    ]

    const filename = `readers_export_${new Date().toISOString().split('T')[0]}.csv`
    await exportToCSV(selectedRows.value, columnConfig, filename)
  }

  return {
    ordersStore,

    sortedReaders,
    paginatedReaders,
    columns,
    totalPages,

    pagination: readonly(pagination),
    sortState: readonly(sortState),
    selectedRows,
    hasSelection,
    selectionCount,
    baseColumnsConfig,

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
    pageSizeOptions,

    exportToCSV,
    exportReadersToCSV
  }
}
