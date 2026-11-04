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
          v-text="$t('distribution_royalty_report.title')"
        />

        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-arrow-down-tray"
            variant="outline"
            :label="$t('common.export_csv', { length: rows.length })"
            :disabled="isLoading || !rows.length"
            @click="exportReport"
          />
          <UTooltip
            :text="$t('common.refresh')"
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

      <UTable
        :columns="columns"
        :data="tableRows"
        :loading="isLoading"
        :ui="{
          root: 'lg:overflow-visible',
          thead: 'lg:sticky lg:top-(--sales-report-sticky-top) lg:z-[5] bg-default',
          th: 'text-center',
          td: 'text-center',
        }"
      >
        <template #paymentId-cell="{ row }">
          <ULink
            v-if="row.original.payoutId"
            :to="localeRoute({
              name: 'sales-report-payouts-payoutId',
              params: { payoutId: row.original.payoutId },
            })"
            class="font-mono"
          >
            {{ row.original.paymentId }}
          </ULink>
          <span
            v-else-if="row.original.paymentId"
            class="font-mono"
            v-text="row.original.paymentId"
          />
          <span
            v-else
            class="text-muted"
          >-</span>
        </template>
        <template #empty>
          <span
            class="text-muted"
            v-text="$t('distribution_royalty_report.empty')"
          />
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import type { DistributionRoyalty } from '~/types'

type DistributionRoyaltyRow = {
  period: string
  grossUsd: number
  feeUsd: number
  payableUsd: number
  status: string
  paymentId: string
  paidAt: string
  amountUsd?: number
  payoutId?: string
}

const apiFetch = useLikeCoApiFetch()
const { t: $t } = useI18n()
const localeRoute = useLocaleRoute()

const { showErrorToast } = useToastComposable()
const error = ref('')
const isLoading = ref(false)

const royalties = ref<DistributionRoyalty[]>([])

whenever(isLoading, () => { error.value = '' })

onMounted(loadReport)

const columns = computed(() => [
  { accessorKey: 'period', header: $t('distribution_royalty_report.period') },
  { accessorKey: 'grossUsd', header: $t('distribution_royalty_report.gross_usd') },
  { accessorKey: 'feeUsd', header: $t('distribution_royalty_report.fee') },
  { accessorKey: 'payableUsd', header: $t('distribution_royalty_report.payable_usd') },
  { accessorKey: 'status', header: $t('user_settings.status') },
  { accessorKey: 'paymentId', header: $t('distribution_royalty_report.payment_id') },
  { accessorKey: 'paidAt', header: $t('distribution_royalty_report.paid_at') },
  { accessorKey: 'amountUsd', header: $t('distribution_royalty_report.payment_amount') },
])

// A quarter paid in several transfers gets one row per payment, repeating the quarter totals.
const rows = computed<DistributionRoyaltyRow[]>(() => royalties.value.flatMap((royalty) => {
  const quarter = {
    period: royalty.period,
    grossUsd: royalty.grossUsd,
    feeUsd: royalty.feeUsd,
    payableUsd: royalty.payableUsd,
    status: $t(`distribution_royalty_report.status_${royalty.status}`),
  }
  if (!royalty.payments.length) {
    return [{ ...quarter, paymentId: '', paidAt: '' }]
  }
  return royalty.payments.map(payment => ({
    ...quarter,
    paymentId: payment.paymentId,
    paidAt: payment.paidAt ? new Date(payment.paidAt).toLocaleString() : '',
    amountUsd: payment.amountUsd,
    payoutId: payment.payoutId,
  }))
}))

function formatUsd(value?: number) {
  if (value === undefined) return '-'
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const tableRows = computed(() => rows.value.map(row => ({
  ...row,
  grossUsd: formatUsd(row.grossUsd),
  feeUsd: formatUsd(row.feeUsd),
  payableUsd: formatUsd(row.payableUsd),
  paidAt: row.paidAt || '-',
  amountUsd: formatUsd(row.amountUsd),
})))

async function loadReport() {
  try {
    isLoading.value = true
    const data = await apiFetch<{ royalties?: DistributionRoyalty[] }>(
      '/likernft/book/user/distribution-royalties/list',
    )
    royalties.value = data?.royalties || []
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
  useLogEvent('sales_report_export_distribution_royalty')
  const date = new Date().toISOString().split('T')[0]
  await downloadCSV(rows.value, columns.value, `distribution-royalty-${date}.csv`)
}
</script>
