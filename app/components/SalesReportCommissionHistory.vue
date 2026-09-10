<template>
  <div class="space-y-6">
    <AppErrorAlert v-model="error" />

    <UCard
      :ui="{
        header: 'flex justify-between items-center',
        body: 'p-0 sm:p-0',
        footer: 'text-center',
      }"
    >
      <template #header>
        <h1
          class="text-center font-bold font-mono"
          v-text="$t('user_settings.commission_history')"
        />

        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-arrow-down-tray"
            variant="outline"
            :disabled="isLoading || !commissionHistoryRows.length"
            @click="exportCommissionHistory"
          >
            {{ $t('common.export_csv', { length: commissionHistoryRows.length }) }}
          </UButton>
          <UTooltip
            :text="$t('user_settings.commission_history.tooltip')"
            :popper="{ placement: 'left' }"
          >
            <UButton
              icon="i-heroicons-arrow-path"
              variant="outline"
              :disabled="isLoading"
              @click="loadCommissionHistory"
            />
          </UTooltip>
        </div>
      </template>

      <UTable
        :columns="[
          { accessorKey: 'timestamp', header: $t('user_settings.timestamp') },
          { accessorKey: 'type', header: $t('user_settings.commission_type') },
          { accessorKey: 'amount', header: $t('user_settings.commission') },
          { accessorKey: 'classId', header: $t('user_settings.book_id') },
          { accessorKey: 'buyerEmail', header: $t('table.buyer_email') },
          { accessorKey: 'currency', header: $t('user_settings.currency') },
          { accessorKey: 'amountTotal', header: $t('user_settings.sale_amount') },
          { accessorKey: 'stripeFeeAmount', header: $t('user_settings.transaction_fee') },
        ]"
        :data="commissionHistoryRows"
        :ui="{ th: 'text-center', td: 'text-center' }"
      >
        <template #classId-cell="{ row }">
          <a
            v-if="row.original.classId"
            :href="`${BOOK3_URL}/store/${row.original.classId}`"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ nftStore.getClassNameById(row.original.classId) || row.original.classId }}
          </a>
          <span v-else-if="row.original.description">{{ row.original.description }}</span>
          <span
            v-else
            class="text-gray-400"
          >-</span>
        </template>
        <template #buyerEmail-cell="{ row }">
          <a
            v-if="row.original.buyerEmail"
            :href="`mailto:${row.original.buyerEmail}`"
          >
            {{ row.original.buyerEmail }}
          </a>
          <span
            v-else
            class="text-gray-400"
          >-</span>
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import type { CommissionRow } from '~/types'

const { BOOK3_URL } = useRuntimeConfig().public
const apiFetch = useLikeCoApiFetch()
const { t: $t } = useI18n()

const nftStore = useNftStore()

const { showErrorToast } = useToastComposable()
const error = ref('')
const isLoading = ref(false)

const commissionHistory = ref<CommissionRow[]>([])

whenever(isLoading, () => { error.value = '' })

onMounted(loadCommissionHistory)

const commissionHistoryRows = computed(() => {
  return commissionHistory.value.map((row: CommissionRow) => {
    let type = row.type
    switch (type) {
      case 'connectedWallet':
        type = 'royalties'
        break
      case 'channelCommission':
        type = 'channel'
        break
    }
    return {
      ...row,
      type,
      amount: formatNumberWithCurrency(row.amount, row.currency),
      amountTotal: formatNumberWithCurrency(row.amountTotal, row.currency),
      stripeFeeAmount: row.stripeFeeAmount !== undefined
        ? formatNumberWithCurrency(row.stripeFeeAmount, row.currency)
        : '-',
      currency: formatCurrency(row.currency),
      buyerEmail: row.buyerEmail || '',
      timestamp: new Date(row.timestamp).toLocaleString(),
    }
  })
})

async function loadCommissionHistory() {
  try {
    isLoading.value = true
    const data = await apiFetch('/likernft/book/user/commissions/list')
    commissionHistory.value = (data as { commissions?: CommissionRow[] })?.commissions || []

    const classIds = new Set<string>(commissionHistory.value
      .filter((row: CommissionRow) => !!row.classId)
      .map((row: CommissionRow) => row.classId as string))
    classIds.forEach((classId: string) => nftStore.lazyFetchClassNameById(classId))
  }
  catch (e) {
    console.error(e)
    error.value = (e as Error).toString()
    showErrorToast(e)
  }
  finally {
    isLoading.value = false
  }
}

async function exportCommissionHistory() {
  useLogEvent('sales_report_export_commission')
  const date = new Date().toISOString().split('T')[0]

  const columns = [
    { accessorKey: 'timestamp', header: $t('user_settings.timestamp') },
    { accessorKey: 'type', header: $t('user_settings.commission_type') },
    { accessorKey: 'bookName', header: $t('table.book_name') },
    { accessorKey: 'classId', header: $t('user_settings.book_id') },
    { accessorKey: 'buyerEmail', header: $t('table.buyer_email') },
    { accessorKey: 'amount', header: $t('user_settings.commission') },
    { accessorKey: 'amountTotal', header: $t('user_settings.sale_amount') },
    { accessorKey: 'stripeFeeAmount', header: $t('user_settings.transaction_fee') },
    { accessorKey: 'currency', header: $t('user_settings.currency') },
  ]

  const data = commissionHistory.value.map((row: CommissionRow) => ({
    timestamp: new Date(row.timestamp).toLocaleString(),
    type: (() => {
      let type = row.type
      switch (type) {
        case 'connectedWallet':
          type = 'royalties'
          break
        case 'channelCommission':
          type = 'channel'
          break
      }
      return type
    })(),
    bookName: (row.classId ? nftStore.getClassNameById(row.classId) : row.description) || '',
    classId: row.classId || '',
    buyerEmail: row.buyerEmail || '',
    amount: convertDecimalToAmount(row.amount, row.currency),
    currency: formatCurrency(row.currency),
    amountTotal: convertDecimalToAmount(row.amountTotal, row.currency),
    stripeFeeAmount: row.stripeFeeAmount !== undefined
      ? convertDecimalToAmount(row.stripeFeeAmount, row.currency)
      : '',
  }))

  await downloadCSV(data, columns, `sales-commission-history-${date}.csv`)
}
</script>
