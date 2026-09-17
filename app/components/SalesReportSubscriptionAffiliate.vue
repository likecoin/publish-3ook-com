<template>
  <div class="space-y-6">
    <AppErrorAlert v-model="error" />

    <UCard
      :ui="{
        root: 'lg:overflow-visible',
        header: 'flex justify-between items-center',
        body: 'p-0 sm:p-0',
      }"
    >
      <template #header>
        <h1
          class="text-center font-bold font-mono"
          v-text="$t('subscription_affiliate_report.title')"
        />

        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-arrow-down-tray"
            variant="outline"
            :label="$t('common.export_csv', { length: reportRows.length })"
            :disabled="isLoading || !reportRows.length"
            @click="exportReport"
          />
          <UTooltip
            :text="$t('subscription_affiliate_report.refresh')"
            :popper="{ placement: 'left' }"
          >
            <UButton
              icon="i-heroicons-arrow-path"
              variant="outline"
              :disabled="isLoading"
              @click="loadReport"
            />
          </UTooltip>
        </div>
      </template>

      <div class="flex flex-wrap justify-center gap-8 px-6 py-4 border-b border-default">
        <div
          v-for="stat in summaryStats"
          :key="stat.label"
          class="text-center"
        >
          <div
            class="text-sm text-muted"
            v-text="stat.label"
          />
          <div
            class="text-lg font-bold"
            v-text="stat.value"
          />
        </div>
      </div>

      <UTable
        :columns="columns"
        :data="reportRows"
        :ui="{
          // Sticks under the tabs only where all columns fit;
          // narrower screens keep horizontal scroll, which disables sticky.
          // The offset is owned by sales-report/index.vue.
          root: 'lg:overflow-visible',
          thead: 'lg:sticky lg:top-(--sales-report-sticky-top) lg:z-[5] bg-default',
          th: 'text-center',
          td: 'text-center',
        }"
      >
        <template #empty>
          <span
            class="text-muted"
            v-text="$t('subscription_affiliate_report.empty')"
          />
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import type { SubscriptionAffiliateReport, SubscriptionAffiliateRow } from '~/types'

const apiFetch = useLikeCoApiFetch()
const { t: $t } = useI18n()

const { showErrorToast } = useToastComposable()
const error = ref('')
const isLoading = ref(false)

const payouts = ref<SubscriptionAffiliateRow[]>([])
const summary = ref<SubscriptionAffiliateReport['summary']>()

whenever(isLoading, () => { error.value = '' })

onMounted(loadReport)

const columns = computed(() => [
  { accessorKey: 'payoutAt', header: $t('subscription_affiliate_report.payout_at') },
  { accessorKey: 'subscribedAt', header: $t('subscription_affiliate_report.subscribed_at') },
  { accessorKey: 'interval', header: $t('subscription_affiliate_report.interval') },
  { accessorKey: 'commissionRate', header: $t('subscription_affiliate_report.commission_rate') },
  { accessorKey: 'subscriptionAmount', header: $t('subscription_affiliate_report.subscription_amount') },
  { accessorKey: 'fee', header: $t('subscription_affiliate_report.fee') },
  { accessorKey: 'payoutAmount', header: $t('subscription_affiliate_report.payout_amount') },
])

// The ledger stores integer cents, the unit convertDecimalToAmount expects.
const reportRows = computed(() => payouts.value.map((row: SubscriptionAffiliateRow) => ({
  payoutAt: row.payoutAt ? new Date(row.payoutAt).toLocaleString() : '-',
  subscribedAt: row.subscribedAt ? new Date(row.subscribedAt).toLocaleString() : '-',
  interval: $t(`subscription_affiliate_report.interval_${row.interval}`),
  commissionRate: `${Math.round(row.commissionRate * 100)}%`,
  subscriptionAmount: formatNumberWithCurrency(row.balanceTxCents, row.currency),
  fee: formatNumberWithCurrency(row.feeCents, row.currency),
  payoutAmount: formatNumberWithCurrency(row.payoutCents, row.currency),
})))

const summaryStats = computed(() => {
  if (!summary.value) return []
  const currency = payouts.value[0]?.currency || 'usd'
  return [
    {
      label: $t('subscription_affiliate_report.summary_total'),
      value: formatNumberWithCurrency(summary.value.totalCents, currency),
    },
    {
      label: $t('subscription_affiliate_report.summary_subscriptions'),
      value: String(summary.value.subscriptionCount),
    },
  ]
})

async function loadReport() {
  try {
    isLoading.value = true
    const data = await apiFetch<SubscriptionAffiliateReport>(
      '/likernft/book/user/subscription-affiliate/report',
    )
    payouts.value = data?.payouts || []
    summary.value = data?.summary
  }
  catch (e) {
    error.value = (e as Error).toString()
    showErrorToast(e)
  }
  finally {
    isLoading.value = false
  }
}

async function exportReport() {
  useLogEvent('sales_report_export_subscription_affiliate')
  const date = new Date().toISOString().split('T')[0]

  const columnsForExport = [
    { accessorKey: 'payoutAt', header: $t('subscription_affiliate_report.payout_at') },
    { accessorKey: 'subscribedAt', header: $t('subscription_affiliate_report.subscribed_at') },
    { accessorKey: 'subscriptionId', header: 'Subscription ID' },
    { accessorKey: 'transferId', header: 'Transfer ID' },
    { accessorKey: 'interval', header: $t('subscription_affiliate_report.interval') },
    { accessorKey: 'commissionRate', header: $t('subscription_affiliate_report.commission_rate') },
    { accessorKey: 'subscriptionAmount', header: $t('subscription_affiliate_report.subscription_amount') },
    { accessorKey: 'fee', header: $t('subscription_affiliate_report.fee') },
    { accessorKey: 'payoutAmount', header: $t('subscription_affiliate_report.payout_amount') },
    { accessorKey: 'currency', header: $t('user_settings.currency') },
  ]

  const data = payouts.value.map((row: SubscriptionAffiliateRow) => ({
    payoutAt: row.payoutAt ? new Date(row.payoutAt).toLocaleString() : '',
    subscribedAt: row.subscribedAt ? new Date(row.subscribedAt).toLocaleString() : '',
    subscriptionId: row.subscriptionId,
    transferId: row.transferId,
    interval: row.interval,
    commissionRate: row.commissionRate,
    subscriptionAmount: convertDecimalToAmount(row.balanceTxCents, row.currency),
    fee: convertDecimalToAmount(row.feeCents, row.currency),
    payoutAmount: convertDecimalToAmount(row.payoutCents, row.currency),
    currency: formatCurrency(row.currency),
  }))

  await downloadCSV(data, columnsForExport, `subscription-affiliate-report-${date}.csv`)
}
</script>
