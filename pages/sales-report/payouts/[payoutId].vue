<template>
  <PageBody class="space-y-10 pb-10">
    <div class="flex justify-between gap-4">
      <h1 class="text-lg font-bold font-mono flex-wrap">
        {{ $t('user_settings.payout_details') }} - {{ payoutId }}
      </h1>
    </div>

    <UProgress v-if="isLoading" animation="carousel">
      <template #indicator>
        {{ $t('loading.progress') }}
      </template>
    </UProgress>

    <UAlert
      v-if="fetchError"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="`${fetchError}`"
    />

    <UCard
      :ui="{
        header: 'flex justify-between items-center',
        body: 'p-0'
      }"
    >
      <template #header>
        <h3 class="font-bold font-mono">
          {{ $t('user_settings.payout_details') }}
        </h3>

        <UButton
          icon="i-heroicons-arrow-down-tray"
          variant="outline"
          size="sm"
          :disabled="isLoading || !payoutDataRows.length"
          @click="exportPayoutData"
        >
          {{ $t('common.export_csv', { length: payoutDataRows.length }) }}
        </UButton>
      </template>

      <UTable
        :columns="[
          { accessorKey: 'id', header: $t('table.id') },
          { accessorKey: 'createdTs', header: $t('table.created') },
          { accessorKey: 'currency', header: $t('table.currency') },
          { accessorKey: 'amount', header: $t('table.payout_amount') },
          { accessorKey: 'status', header: $t('table.status') },
          { accessorKey: 'arrivalTs', header: $t('table.arrived') },
        ]"
        :data="payoutDataRows"
        :loading="isLoading"
        :ui="{ th: 'text-center', td: 'text-center' }"
      />
    </UCard>

    <UCard :ui="{ body: 'p-0', header: 'flex justify-between items-center' }">
      <template #header>
        <h3 class="text-sm font-bold font-mono">
          {{ $t('user_settings.payout_details') }}
        </h3>

        <UButton
          icon="i-heroicons-arrow-down-tray"
          variant="outline"
          size="sm"
          :disabled="isLoading || !payoutItemRows.length"
          @click="exportPayoutItems"
        >
          {{ $t('common.export_csv', { length: payoutItemRows.length }) }}
        </UButton>
      </template>
      <UTable
        :columns="[
          { accessorKey: 'commissionId', header: $t('table.id') },
          { accessorKey: 'createdTs', header: $t('table.created') },
          { accessorKey: 'currency', header: $t('table.currency') },
          { accessorKey: 'amount', header: $t('table.commission_amount') },
          { accessorKey: 'description', header: $t('common.description') },
          { accessorKey: 'status', header: $t('table.status') },
          { accessorKey: 'metadata', header: $t('table.metadata') },
        ]"
        :data="payoutItemRows"
        :loading="isLoading"
        :ui="{ th: 'text-center', td: 'text-center' }"
      >
        <template #metadata-cell="{ row }">
          <UButton
            :label="$t('buttons.view_edit')"
            color="neutral"
            @click="modalMetadata = row.original.metadata"
          />
        </template>
      </UTable>
    </UCard>

    <UModal v-model:open="isModalMetadataOpen">
      <template #header>
        <h4 class="font-mono font-bold" v-text="$t('table.metadata')" />

        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-x-mark-20-solid"
          square
          @click="isModalMetadataOpen = false"
        />
      </template>

      <template #body>
        <pre v-text="modalMetadata" />
      </template>
    </UModal>
  </PageBody>
</template>

<script setup lang="ts">
import type { PayoutData, PayoutItemDetail } from '~/types'

const { t: $t } = useI18n()

const { LIKE_CO_API } = useRuntimeConfig().public
const bookstoreApiStore = useBookstoreApiStore()
const { token } = storeToRefs(bookstoreApiStore)

const route = useRoute()
const payoutId = ref(route.params.payoutId as string)

const modalMetadata = ref('')
const isModalMetadataOpen = computed({
  get: () => !!modalMetadata.value,
  set: (value) => {
    if (!value) {
      modalMetadata.value = ''
    }
  }
})

const { data: payoutData, status: fetchStatus, error: fetchError } = useLazyAsyncData(
  `payout-${payoutId.value}`,
  () => $fetch(`${LIKE_CO_API}/likernft/book/user/payouts/${payoutId.value}`, {
    headers: { authorization: `Bearer ${token.value}` }
  }) as Promise<PayoutData>,
  { server: false, default: () => ({} as PayoutData) }
)

const isLoading = computed(() => fetchStatus.value === 'pending')
const payoutItemDetails = computed(() => payoutData.value?.items ?? [] as PayoutItemDetail[])

const payoutDataRows = computed(() => {
  if (!payoutData.value) { return [] }
  const {
    id,
    createdTs,
    amount,
    status,
    currency,
    arrivalTs
  } = payoutData.value
  return [
    {
      id,
      createdTs: new Date(createdTs * 1000).toLocaleString(),
      amount: formatNumberWithCurrency(amount, currency),
      status,
      currency: formatCurrency(currency),
      arrivalTs: arrivalTs ? new Date(arrivalTs * 1000).toLocaleString() : ''
    }
  ]
})

const payoutItemRows = computed(() => {
  return payoutItemDetails.value.map((row) => {
    const {
      commissionId,
      createdTs,
      amount,
      currency,
      description,
      status,
      metadata
    } = row
    return {
      commissionId,
      createdTs: new Date(createdTs * 1000).toLocaleString(),
      amount: formatNumberWithCurrency(amount, currency),
      currency: formatCurrency(currency),
      description,
      status,
      metadata: JSON.stringify(metadata, null, 2)
    }
  })
})

async function exportPayoutData () {
  if (!payoutDataRows.value.length) { return }

  const date = new Date().toISOString().split('T')[0]

  const columns = [
    { accessorKey: 'id', header: $t('table.id') },
    { accessorKey: 'createdTs', header: $t('table.created') },
    { accessorKey: 'amount', header: $t('table.payout_amount') },
    { accessorKey: 'currency', header: $t('table.currency') },
    { accessorKey: 'status', header: $t('table.status') },
    { accessorKey: 'arrivalTs', header: $t('table.arrived') }
  ]

  const { id, createdTs, amount, currency, status, arrivalTs } = payoutData.value
  const data = [{
    id,
    createdTs: new Date(createdTs * 1000).toLocaleString(),
    currency: formatCurrency(currency),
    amount: convertDecimalToAmount(amount, currency),
    status,
    arrivalTs: arrivalTs ? new Date(arrivalTs * 1000).toLocaleString() : ''
  }]

  await downloadCSV(data, columns, `payout-details-${payoutId.value}-${date}.csv`)
}

async function exportPayoutItems () {
  if (!payoutItemRows.value.length) { return }

  const date = new Date().toISOString().split('T')[0]

  const columns = [
    { accessorKey: 'commissionId', header: $t('table.id') },
    { accessorKey: 'createdTs', header: $t('table.created') },
    { accessorKey: 'amount', header: $t('table.commission_amount') },
    { accessorKey: 'currency', header: $t('table.currency') },
    { accessorKey: 'description', header: $t('common.description') },
    { accessorKey: 'status', header: $t('table.status') },
    { accessorKey: 'metadata', header: $t('table.metadata') }
  ]

  const data = payoutItemDetails.value.map(row => ({
    commissionId: row.commissionId,
    createdTs: new Date(row.createdTs * 1000).toLocaleString(),
    currency: formatCurrency(row.currency),
    amount: convertDecimalToAmount(row.amount, row.currency),
    description: row.description || '',
    status: row.status,
    metadata: row.metadata ? JSON.stringify(row.metadata, null, 2) : ''
  }))

  await downloadCSV(data, columns, `payout-items-${payoutId.value}-${date}.csv`)
}
</script>
