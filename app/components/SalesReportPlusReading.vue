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
          v-text="$t('plus_reading_report.title')"
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
            :text="$t('plus_reading_report.refresh')"
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

      <div class="flex flex-wrap justify-center gap-8 px-6 py-4">
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
        :columns="[
          { accessorKey: 'periodId', header: $t('plus_reading_report.period') },
          { accessorKey: 'classId', header: $t('table.book_name') },
          { accessorKey: 'readingMinutes', header: $t('plus_reading_report.reading_minutes') },
          { accessorKey: 'listeningMinutes', header: $t('plus_reading_report.listening_minutes') },
          { accessorKey: 'amount', header: $t('user_settings.commission') },
          { accessorKey: 'status', header: $t('user_settings.status') },
        ]"
        :data="reportRows"
        :ui="{ th: 'text-center', td: 'text-center' }"
      >
        <template #classId-cell="{ row }">
          <a
            :href="`${BOOK3_URL}/store/${row.original.classId || ''}`"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ (row.original.classId ? nftStore.getClassMetadataById(row.original.classId)?.name : '') || row.original.classId || '' }}
          </a>
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :color="row.original.status === 'paid' ? 'success' : 'warning'"
            variant="soft"
          >
            {{ row.original.status === 'paid'
              ? $t('plus_reading_report.status_paid')
              : $t('plus_reading_report.status_pending') }}
          </UBadge>
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { PlusReadingReport, PlusReadingReportEntry } from '~/types'

const { BOOK3_URL } = useRuntimeConfig().public
const apiFetch = useLikeCoApiFetch()
const { t: $t } = useI18n()

const nftStore = useNftStore()

const { showErrorToast } = useToastComposable()
const error = ref('')
const isLoading = ref(false)

const payouts = ref<PlusReadingReportEntry[]>([])
const summary = ref<PlusReadingReport['summary']>({
  totalCents: 0,
  paidCents: 0,
  pendingCents: 0,
  periodCount: 0,
  bookCount: 0,
})

onMounted(async () => {
  await loadReport()
})

const summaryStats = computed(() => [
  { label: $t('plus_reading_report.summary_total'), value: formatNumberWithCurrency(summary.value.totalCents, 'usd') },
  { label: $t('plus_reading_report.status_paid'), value: formatNumberWithCurrency(summary.value.paidCents, 'usd') },
  { label: $t('plus_reading_report.status_pending'), value: formatNumberWithCurrency(summary.value.pendingCents, 'usd') },
])

const reportRows = computed(() => {
  return payouts.value.map((row: PlusReadingReportEntry) => ({
    ...row,
    readingMinutes: convertMsToMinutes(row.readingTimeMs),
    listeningMinutes: convertMsToMinutes(row.ttsTimeMs),
    amount: formatNumberWithCurrency(row.amountCents, row.currency),
  }))
})

async function loadReport() {
  try {
    isLoading.value = true
    error.value = ''
    const data = await apiFetch<PlusReadingReport>('/likernft/book/user/plus-reading/report')
    payouts.value = data?.payouts || []
    summary.value = data?.summary || summary.value

    const classIds = new Set<string>(payouts.value
      .filter((row: PlusReadingReportEntry) => !!row.classId)
      .map((row: PlusReadingReportEntry) => row.classId))
    classIds.forEach((classId: string) => nftStore.lazyFetchClassMetadataById(classId))
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
  useLogEvent('plus_reading_report_export')
  const date = new Date().toISOString().split('T')[0]

  const columns = [
    { accessorKey: 'periodId', header: $t('plus_reading_report.period') },
    { accessorKey: 'bookName', header: $t('table.book_name') },
    { accessorKey: 'classId', header: $t('user_settings.book_id') },
    { accessorKey: 'readingMinutes', header: $t('plus_reading_report.reading_minutes') },
    { accessorKey: 'listeningMinutes', header: $t('plus_reading_report.listening_minutes') },
    { accessorKey: 'readRatePerMin', header: $t('plus_reading_report.read_rate') },
    { accessorKey: 'ttsRatePerMin', header: $t('plus_reading_report.tts_rate') },
    { accessorKey: 'amount', header: $t('user_settings.commission') },
    { accessorKey: 'currency', header: $t('user_settings.currency') },
    { accessorKey: 'status', header: $t('user_settings.status') },
  ]

  const data = payouts.value.map((row: PlusReadingReportEntry) => ({
    periodId: row.periodId,
    bookName: (row.classId ? nftStore.getClassMetadataById(row.classId)?.name : '') || '',
    classId: row.classId,
    readingMinutes: convertMsToMinutes(row.readingTimeMs),
    listeningMinutes: convertMsToMinutes(row.ttsTimeMs),
    readRatePerMin: row.readRatePerMin,
    ttsRatePerMin: row.ttsRatePerMin,
    amount: convertDecimalToAmount(row.amountCents, row.currency),
    currency: formatCurrency(row.currency),
    status: row.status,
  }))

  await downloadCSV(data, columns, `plus-reading-report-${date}.csv`)
}
</script>
