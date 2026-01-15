<template>
  <PageBody>
    <UAlert
      v-if="error"
      icon="i-heroicons-exclamation-triangle"
      color="red"
      variant="soft"
      :title="`${error}`"
      :close-button="{ icon: 'i-heroicons-x-mark-20-solid', color: 'red', variant: 'link', padded: false }"
      @close="error = ''"
    />

    <UAlert
      v-if="!isStripeConnectReady"
      icon="i-heroicons-exclamation-circle"
      color="orange"
      variant="soft"
      :title="$t('user_settings.stripe_express_notice')"
      :description="$t('user_settings.stripe_express_description')"
    />

    <UCard
      :ui="{
        header: { base: 'flex justify-between items-center' },
        body: { padding: '' },
        footer: { base: 'text-center' },
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
          { key: 'timestamp', label: $t('user_settings.timestamp') },
          { key: 'type', label: $t('user_settings.commission_type') },
          { key: 'amount', label: $t('user_settings.commission') },
          { key: 'classId', label: $t('user_settings.book_id') },
          { key: 'currency', label: $t('user_settings.currency') },
          { key: 'amountTotal', label: $t('user_settings.sale_amount') },
        ]"
        :rows="commissionHistoryRows"
        :ui="{ th: { base: 'text-center' }, td: { base: 'text-center' } }"
      >
        <template #classId-data="{ row }">
          <a :href="`${BOOK3_URL}/store/${row.classId}`" target="_blank">
            {{ nftStore.getClassMetadataById(row.classId)?.name || row.classId }}
          </a>
        </template>
      </UTable>
    </UCard>
    <UCard
      :ui="{
        header: { base: 'flex justify-between items-center' },
        body: { padding: '' },
        footer: { base: 'text-center' },
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
          { key: 'createdTs', label: $t('user_settings.created') },
          { key: 'amount', label: $t('user_settings.payout_amount') },
          { key: 'status', label: $t('user_settings.status') },
          { key: 'arrivalTs', label: $t('user_settings.arrived') },
          { key: 'details', label: $t('user_settings.details') },
        ]"
        :rows="payoutHistoryRows"
        :ui="{ th: { base: 'text-center' }, td: { base: 'text-center' } }"
      >
        <template #details-data="{ row }">
          <UButton
            :label="$t('user_settings.details')"
            size="sm"
            color="gray"
            :to="localeRoute({
              name: 'sales-report-payouts-payoutId',
              params: {
                payoutId: row.id
              }
            })"
          />
        </template>
      </UTable>
    </UCard>
  </PageBody>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { downloadCSV } from '~/utils/index'

const { LIKE_CO_API, BOOK3_URL } = useRuntimeConfig().public
const { t: $t } = useI18n()

const nftStore = useNftStore()
const bookstoreApiStore = useBookstoreApiStore()

const { token, wallet } = storeToRefs(bookstoreApiStore)
const localeRoute = useLocaleRoute()
const stripeStore = useStripeStore()
const { getStripeConnectStatusByWallet } = storeToRefs(stripeStore)

const error = ref('')
const isLoading = ref(false)

const commissionHistory = ref<any>([])
const payoutHistory = ref<any>([])

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
  return commissionHistory.value.map((row: any) => {
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
  return payoutHistory.value.map((row: any) => {
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
    commissionHistory.value = (data as any)?.commissions || []

    const classIds = new Set<string>(commissionHistory.value
      .filter((row: any) => row.classId)
      .map((row: any) => row.classId))
    classIds.forEach((classId: string) => nftStore.lazyFetchClassMetadataById(classId))
  } catch (e) {
    console.error(e)
    error.value = (e as Error).toString()
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
    payoutHistory.value = (data as any)?.payouts || []
  } catch (e) {
    error.value = (e as Error).toString()
  } finally {
    isLoading.value = false
  }
}

async function exportCommissionHistory () {
  const date = new Date().toISOString().split('T')[0]

  const columns = [
    { key: 'timestamp', label: $t('user_settings.timestamp') },
    { key: 'type', label: $t('user_settings.commission_type') },
    { key: 'bookName', label: $t('table.book_name') },
    { key: 'classId', label: $t('user_settings.book_id') },
    { key: 'amount', label: $t('user_settings.commission') },
    { key: 'currency', label: $t('user_settings.currency') },
    { key: 'amountTotal', label: $t('user_settings.sale_amount') }
  ]

  const data = commissionHistoryRows.value.map((row: any) => ({
    timestamp: row.timestamp,
    type: row.type,
    bookName: nftStore.getClassMetadataById(row.classId)?.name || '',
    classId: row.classId,
    amount: row.amount,
    currency: row.currency,
    amountTotal: row.amountTotal
  }))

  await downloadCSV(data, columns, `sales-commission-history-${date}.csv`)
}

async function exportPayoutHistory () {
  const date = new Date().toISOString().split('T')[0]

  const columns = [
    { key: 'createdTs', label: $t('user_settings.created') },
    { key: 'amount', label: $t('user_settings.payout_amount') },
    { key: 'status', label: $t('user_settings.status') },
    { key: 'arrivalTs', label: $t('user_settings.arrived') },
    { key: 'id', label: 'ID' }
  ]

  const data = payoutHistoryRows.value.map((row: any) => ({
    createdTs: row.createdTs,
    amount: row.amount,
    status: row.status,
    arrivalTs: row.arrivalTs,
    id: row.id
  }))

  await downloadCSV(data, columns, `sales-payout-history-${date}.csv`)
}

</script>
