<template>
  <PageBody>
    <UAlert
      v-if="error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="`${error}`"
      :close="{ icon: 'i-heroicons-x-mark-20-solid', color: 'error', variant: 'link' }"
      @close="error = ''"
    />

    <UAlert
      v-if="!isStripeConnectReady"
      icon="i-heroicons-exclamation-circle"
      color="warning"
      variant="soft"
      :title="$t('user_settings.stripe_express_notice')"
      :description="$t('user_settings.stripe_express_description')"
    />

    <UCard
      :ui="{
        header: 'flex justify-between items-center',
        body: 'p-0',
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
          { accessorKey: 'currency', header: $t('user_settings.currency') },
          { accessorKey: 'amountTotal', header: $t('user_settings.sale_amount') },
        ]"
        :data="commissionHistoryRows"
        :ui="{ th: 'text-center', td: 'text-center' }"
      >
        <template #classId-cell="{ row }">
          <a :href="`${BOOK3_URL}/store/${row.original.classId || ''}`" target="_blank">
            {{ (row.original.classId ? nftStore.getClassMetadataById(row.original.classId)?.name : '') || row.original.classId || '' }}
          </a>
        </template>
      </UTable>
    </UCard>
    <UCard
      :ui="{
        header: 'flex justify-between items-center',
        body: 'p-0',
        footer: 'text-center',
      }"
    >
      <template #header>
        <h1
          class="text-center font-bold font-mono"
          v-text="$t('user_settings.payout_history')"
        />

        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-arrow-down-tray"
            variant="outline"
            :disabled="isLoading || !payoutHistoryRows.length"
            @click="exportPayoutHistory"
          >
            {{ $t('common.export_csv', { length: payoutHistoryRows.length }) }}
          </UButton>
          <UTooltip
            text="Refresh Status"
            :popper="{ placement: 'left' }"
          >
            <UButton
              icon="i-heroicons-arrow-path"
              variant="outline"
              :disabled="isLoading"
              @click="loadPayoutHistory"
            />
          </UTooltip>
        </div>
      </template>

      <UTable
        :columns="[
          { accessorKey: 'createdTs', header: $t('user_settings.created') },
          { accessorKey: 'amount', header: $t('user_settings.payout_amount') },
          { accessorKey: 'status', header: $t('user_settings.status') },
          { accessorKey: 'arrivalTs', header: $t('user_settings.arrived') },
          { accessorKey: 'details', header: $t('user_settings.details') },
        ]"
        :data="payoutHistoryRows"
        :ui="{ th: 'text-center', td: 'text-center' }"
      >
        <template #details-cell="{ row }">
          <UButton
            :label="$t('user_settings.details')"
            size="sm"
            color="neutral"
            :to="localeRoute({
              name: 'sales-report-payouts-payoutId',
              params: {
                payoutId: row.original.id
              }
            })"
          />
        </template>
      </UTable>
    </UCard>
  </PageBody>
</template>

<script setup lang="ts">
import type { CommissionRow, PayoutRow } from '~/types'

const { LIKE_CO_API, BOOK3_URL } = useRuntimeConfig().public
const { t: $t } = useI18n()

const nftStore = useNftStore()
const bookstoreApiStore = useBookstoreApiStore()

const { token, wallet } = storeToRefs(bookstoreApiStore)
const localeRoute = useLocaleRoute()
const stripeStore = useStripeStore()
const { getStripeConnectStatusByWallet } = storeToRefs(stripeStore)

const { showErrorToast } = useToastComposable()
const error = ref('')
const isLoading = ref(false)

const commissionHistory = ref<CommissionRow[]>([])
const payoutHistory = ref<PayoutRow[]>([])

watch(isLoading, (newIsLoading) => {
  if (newIsLoading) { error.value = '' }
})

onMounted(async () => {
  await Promise.all([
    loadCommissionHistory(),
    loadPayoutHistory(),
    stripeStore.refreshStripeConnectStatus(wallet.value)

  ])
})

const currentStripeAccount = computed(() => getStripeConnectStatusByWallet.value(wallet.value))
const isStripeConnectReady = computed(() => currentStripeAccount.value?.isReady)

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
      currency: formatCurrency(row.currency),
      timestamp: new Date(row.timestamp).toLocaleString()
    }
  })
})

const payoutHistoryRows = computed(() => {
  return payoutHistory.value.map((row: PayoutRow) => {
    const {
      id,
      amount,
      currency,
      status,
      arrivalTs,
      createdTs
    } = row
    return {
      id,
      amount: formatNumberWithCurrency(amount, currency),
      status,
      createdTs: new Date(createdTs * 1000).toLocaleString(),
      arrivalTs: arrivalTs ? new Date(arrivalTs * 1000).toLocaleString() : ''
    }
  })
})

async function loadCommissionHistory () {
  try {
    isLoading.value = true
    const data = await $fetch(`${LIKE_CO_API}/likernft/book/user/commissions/list`, {
      headers: {
        authorization: `Bearer ${token.value}`
      }
    })
    commissionHistory.value = (data as { commissions?: CommissionRow[] })?.commissions || []

    const classIds = new Set<string>(commissionHistory.value
      .filter((row: CommissionRow) => !!row.classId)
      .map((row: CommissionRow) => row.classId as string))
    classIds.forEach((classId: string) => nftStore.lazyFetchClassMetadataById(classId))
  } catch (e) {
    console.error(e)
    error.value = (e as Error).toString()
    showErrorToast(e)
  } finally {
    isLoading.value = false
  }
}

async function loadPayoutHistory () {
  try {
    isLoading.value = true
    const data = await $fetch(`${LIKE_CO_API}/likernft/book/user/payouts/list`, {
      headers: {
        authorization: `Bearer ${token.value}`
      }
    })
    payoutHistory.value = (data as { payouts?: PayoutRow[] })?.payouts || []
  } catch (e) {
    error.value = (e as Error).toString()
    showErrorToast(e)
  } finally {
    isLoading.value = false
  }
}

async function exportCommissionHistory () {
  const date = new Date().toISOString().split('T')[0]

  const columns = [
    { accessorKey: 'timestamp', header: $t('user_settings.timestamp') },
    { accessorKey: 'type', header: $t('user_settings.commission_type') },
    { accessorKey: 'bookName', header: $t('table.book_name') },
    { accessorKey: 'classId', header: $t('user_settings.book_id') },
    { accessorKey: 'amount', header: $t('user_settings.commission') },
    { accessorKey: 'amountTotal', header: $t('user_settings.sale_amount') },
    { accessorKey: 'currency', header: $t('user_settings.currency') }
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
    bookName: (row.classId ? nftStore.getClassMetadataById(row.classId)?.name : '') || '',
    classId: row.classId || '',
    amount: convertDecimalToAmount(row.amount, row.currency),
    currency: formatCurrency(row.currency),
    amountTotal: convertDecimalToAmount(row.amountTotal, row.currency)
  }))

  await downloadCSV(data, columns, `sales-commission-history-${date}.csv`)
}

async function exportPayoutHistory () {
  const date = new Date().toISOString().split('T')[0]

  const columns = [
    { accessorKey: 'createdTs', header: $t('user_settings.created') },
    { accessorKey: 'amount', header: $t('user_settings.payout_amount') },
    { accessorKey: 'status', header: $t('user_settings.status') },
    { accessorKey: 'arrivalTs', header: $t('user_settings.arrived') },
    { accessorKey: 'id', header: 'ID' }
  ]

  const data = payoutHistory.value.map((row: PayoutRow) => ({
    createdTs: new Date(row.createdTs * 1000).toLocaleString(),
    amount: convertDecimalToAmount(row.amount, row.currency),
    status: row.status,
    arrivalTs: row.arrivalTs ? new Date(row.arrivalTs * 1000).toLocaleString() : '',
    id: row.id
  }))

  await downloadCSV(data, columns, `sales-payout-history-${date}.csv`)
}

</script>
