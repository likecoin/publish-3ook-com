import type { BookInfo, ReaderData } from '~/stores/orders'

export function useReadersTable() {
  const { t } = useI18n()

  const ordersStore = useOrdersStore()

  const {
    pagination,
    sortState,
    pageSizeOptions,
    sortedRows: sortedReaders,
    paginatedRows: paginatedReaders,
    totalPages,
    setSortState,
    setPage,
    setPageSize,
    getSortIcon,
  } = usePaginatedTable<ReaderData>({
    rows: computed(() => ordersStore.readers),
    pageSize: 100,
    compare: (aValue, bValue, column) => {
      if (column.includes('Time')) {
        return new Date(aValue as string | number).getTime()
          - new Date(bValue as string | number).getTime()
      }
      return compareTableValues(aValue, bValue)
    },
    defaultCompare: (a, b) => b.lifetimeValue - a.lifetimeValue,
  })

  const selectedRows = ref<ReaderData[]>([])
  const hasSelection = computed(() => selectedRows.value.length > 0)
  const selectionCount = computed(() => selectedRows.value.length)

  const baseColumnsConfig = computed(() => [
    { key: 'readerEmail', label: t('table.reader_email'), accessorKey: 'readerEmail', header: t('table.reader_email') },
    { key: 'readerWallet', label: t('table.reader_wallet'), accessorKey: 'readerWallet', header: t('table.reader_wallet') },
    { key: 'firstPurchaseTime', label: t('table.first_purchase'), accessorKey: 'firstPurchaseTime', header: t('table.first_purchase') },
    { key: 'lastPurchaseTime', label: t('table.last_purchase'), accessorKey: 'lastPurchaseTime', header: t('table.last_purchase') },
    { key: 'lifetimeValue', label: t('table.lifetime_value'), accessorKey: 'lifetimeValue', header: t('table.lifetime_value') },
    { key: 'hasMessage', label: t('table.has_message'), accessorKey: 'hasMessage', header: t('table.has_message') },
  ])

  const columns = computed(() => {
    const baseColumns = baseColumnsConfig.value.map(col => ({
      key: col.key,
      label: col.label,
      accessorKey: col.accessorKey,
      header: col.header,
    }))

    const bookColumns = Object.values(ordersStore.booksInfo).map((book: BookInfo) => ({
      key: `book_${book.classId}`,
      label: book.name?.slice(0, 1) || book.classId.slice(0, 1),
      accessorKey: `book_${book.classId}`,
      header: book.name?.slice(0, 1) || book.classId.slice(0, 1),
    }))

    return [...baseColumns, ...bookColumns]
  })

  function onSelect(rows: ReaderData[]) {
    selectedRows.value = rows
  }

  function clearSelection() {
    selectedRows.value = []
  }

  function formatDate(dateString: string | number, locale = 'zh-TW'): string {
    if (!dateString) { return '-' }

    const date = new Date(dateString)
    if (isNaN(date.getTime())) { return '-' }

    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  function formatValue(amount: number, decimals = 2): string {
    if (typeof amount !== 'number' || isNaN(amount)) { return '0.00' }
    return `${amount.toFixed(decimals)}`
  }

  function shortenWallet(wallet: string, startLength = 6, endLength = 4): string {
    if (!wallet) { return '' }
    if (wallet.length <= startLength + endLength) { return wallet }

    return `${wallet.slice(0, startLength)}...${wallet.slice(-endLength)}`
  }

  function getWalletLink(wallet: string): string {
    if (!wallet) { return '' }
    return `https://opensea.io/${wallet}`
  }

  function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key]
      }
      return undefined
    }, obj)
  }

  async function exportToCSV(
    data: Record<string, unknown>[],
    columnConfig: { key: string, label: string, formatter?: (value: unknown) => string }[],
    filename?: string,
  ) {
    if (data.length === 0) {
      return
    }

    // Pre-process data with formatters and nested properties
    const processedData = data.map((row) => {
      const result: Record<string, unknown> = {}
      columnConfig.forEach((col) => {
        const value = getNestedValue(row, col.key)
        result[col.label] = col.formatter ? col.formatter(value) : value
      })
      return result
    })

    // Use column labels as keys for the utility
    const columns = columnConfig.map(col => ({ accessorKey: col.label, header: col.label }))
    const finalFilename = filename || `export_${new Date().toISOString().split('T')[0]}.csv`

    await downloadCSV(processedData, columns, finalFilename)
  }

  async function exportReadersToCSV() {
    const dataToExport = hasSelection.value ? selectedRows.value : ordersStore.readers

    const columnConfig: { key: string, label: string, formatter?: (value: unknown) => string }[] = [
      { key: 'readerEmail', label: t('table.reader_email') },
      { key: 'readerWallet', label: t('table.reader_wallet') },
      { key: 'firstPurchaseTime', label: t('table.first_purchase'), formatter: (val: unknown) => formatDate(val as string | number) },
      { key: 'lastPurchaseTime', label: t('table.last_purchase'), formatter: (val: unknown) => formatDate(val as string | number) },
      { key: 'lifetimeValue', label: `${t('table.lifetime_value')} (USD)`, formatter: (val: unknown) => formatValue(val as number) },
      { key: 'hasMessage', label: t('table.has_message'), formatter: (val: unknown) => (val as boolean) ? 'Y' : 'N' },
      ...Object.values(ordersStore.booksInfo).map((book: BookInfo) => ({
        key: `purchasedBooks.${book.classId}`,
        label: book.name || book.classId,
        formatter: (val: unknown) => (val as boolean) ? 'Y' : 'N',
      })),
    ]

    const filename = `readers_export_${new Date().toISOString().split('T')[0]}.csv`
    await exportToCSV(dataToExport as Record<string, unknown>[], columnConfig, filename)
  }

  return {
    ordersStore,

    sortedReaders,
    paginatedReaders,
    columns,
    totalPages,

    pagination,
    sortState,
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
    exportReadersToCSV,
  }
}
