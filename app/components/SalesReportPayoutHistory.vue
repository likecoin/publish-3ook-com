<template>
  <div class="space-y-6">
    <AppErrorAlert v-model="error" />

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
        body: 'p-0 sm:p-0',
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
            :text="$t('user_settings.commission_history.tooltip')"
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
                payoutId: row.original.id,
              },
            })"
          />
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import type { PayoutRow } from '~/types'

const apiFetch = useLikeCoApiFetch()
const { t: $t } = useI18n()

const bookstoreApiStore = useBookstoreApiStore()
const { wallet } = storeToRefs(bookstoreApiStore)
const localeRoute = useLocaleRoute()
const stripeStore = useStripeStore()
const { getStripeConnectStatusByWallet } = storeToRefs(stripeStore)

const { showErrorToast } = useToastComposable()
const error = ref('')
const isLoading = ref(false)

const payoutHistory = ref<PayoutRow[]>([])

whenever(isLoading, () => { error.value = '' })

const currentStripeAccount = computed(() => getStripeConnectStatusByWallet.value(wallet.value))
const isStripeConnectReady = computed(() => currentStripeAccount.value?.isReady)

onMounted(async () => {
  await stripeStore.refreshStripeConnectStatus(wallet.value)
  await loadPayoutHistory()
})

const payoutHistoryRows = computed(() => {
  return payoutHistory.value.map((row: PayoutRow) => {
    const {
      id,
      amount,
      currency,
      status,
      arrivalTs,
      createdTs,
    } = row
    return {
      id,
      amount: formatNumberWithCurrency(amount, currency),
      status,
      createdTs: new Date(createdTs * 1000).toLocaleString(),
      arrivalTs: arrivalTs ? new Date(arrivalTs * 1000).toLocaleString() : '',
    }
  })
})

async function loadPayoutHistory() {
  if (!isStripeConnectReady.value) return
  try {
    isLoading.value = true
    const data = await apiFetch('/likernft/book/user/payouts/list')
    payoutHistory.value = (data as { payouts?: PayoutRow[] })?.payouts || []
  }
  catch (e) {
    error.value = (e as Error).toString()
    showErrorToast(e)
  }
  finally {
    isLoading.value = false
  }
}

async function exportPayoutHistory() {
  useLogEvent('sales_report_export_payout')
  const date = new Date().toISOString().split('T')[0]

  const columns = [
    { accessorKey: 'createdTs', header: $t('user_settings.created') },
    { accessorKey: 'amount', header: $t('user_settings.payout_amount') },
    { accessorKey: 'status', header: $t('user_settings.status') },
    { accessorKey: 'arrivalTs', header: $t('user_settings.arrived') },
    { accessorKey: 'id', header: 'ID' },
  ]

  const data = payoutHistory.value.map((row: PayoutRow) => ({
    createdTs: new Date(row.createdTs * 1000).toLocaleString(),
    amount: convertDecimalToAmount(row.amount, row.currency),
    status: row.status,
    arrivalTs: row.arrivalTs ? new Date(row.arrivalTs * 1000).toLocaleString() : '',
    id: row.id,
  }))

  await downloadCSV(data, columns, `sales-payout-history-${date}.csv`)
}
</script>
