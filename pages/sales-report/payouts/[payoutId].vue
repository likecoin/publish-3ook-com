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

    <UCard
      :ui="{
        header: { base: 'flex justify-between items-center' },
        body: { padding: '' }
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
          { key: 'id', label: $t('table.id') },
          { key: 'createdTs', label: $t('table.created') },
          { key: 'currency', label: $t('table.currency') },
          { key: 'amount', label: $t('table.payout_amount') },
          { key: 'status', label: $t('table.status') },
          { key: 'arrivalTs', label: $t('table.arrived') },
        ]"
        :rows="payoutDataRows"
        :loading="isLoading"
        :ui="{ th: { base: 'text-center' }, td: { base: 'text-center' } }"
      />
    </UCard>

    <UCard :ui="{ body: { padding: '' }, header: { base: 'flex justify-between items-center' } }">
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
          { key: 'commissionId', label: $t('table.id') },
          { key: 'createdTs', label: $t('table.created') },
          { key: 'currency', label: $t('table.currency') },
          { key: 'amount', label: $t('table.commission_amount') },
          { key: 'description', label: $t('common.description') },
          { key: 'status', label: $t('table.status') },
          { key: 'metadata', label: $t('table.metadata') },
        ]"
        :rows="payoutItemRows"
        :loading="isLoading"
        :ui="{ th: { base: 'text-center' }, td: { base: 'text-center' } }"
      >
        <template #metadata-data="{ row }">
          <UButton
            :label="$t('buttons.view_edit')"
            color="gray"
            @click="modalMetadata = row.metadata"
          />
        </template>
      </UTable>
    </UCard>

    <UModal v-model="isModalMetadataOpen">
      <UCard
        :ui="{
          header: { base: 'flex items-center justify-between gap-2' },
          body: { base: 'overflow-auto text-sm' }
        }"
      >
        <template #header>
          <h4 class="font-mono font-bold" v-text="$t('table.metadata')" />

          <UButton
            color="gray"
            variant="ghost"
            icon="i-heroicons-x-mark-20-solid"
            square
            padded
            @click="isModalMetadataOpen = false"
          />
        </template>

        <pre v-text="modalMetadata" />
      </UCard>
    </UModal>
  </PageBody>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useBookstoreApiStore } from '~/stores/book-store-api'
import { downloadCSV } from '~/utils/index'

const { t: $t } = useI18n()

const { LIKE_CO_API } = useRuntimeConfig().public
const bookstoreApiStore = useBookstoreApiStore()
const { token } = storeToRefs(bookstoreApiStore)

const route = useRoute()
const payoutData = ref<any>({})
const payoutItemDetails = ref<any>([])

const error = ref('')
const isLoading = ref(false)
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

watch(isLoading, (newIsLoading) => {
  if (newIsLoading) { error.value = '' }
})

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
  return payoutItemDetails.value.map((row: any) => {
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

onMounted(async () => {
  try {
    isLoading.value = true
    const data = await $fetch(`${LIKE_CO_API}/likernft/book/user/payouts/${payoutId.value}`,
      {
        headers: {
          authorization: `Bearer ${token.value}`
        }
      })
    payoutData.value = (data as any)
    if (payoutData.value.items) {
      payoutItemDetails.value = payoutData.value.items
    }
  } finally {
    isLoading.value = false
  }
})

async function exportPayoutData () {
  if (!payoutDataRows.value.length) { return }

  const headers = [
    $t('table.id'),
    $t('table.created'),
    $t('table.currency'),
    $t('table.payout_amount'),
    $t('table.status'),
    $t('table.arrived')
  ]

  const rows = payoutDataRows.value.map((row: any) => [
    `"${row.id}"`,
    `"${row.createdTs}"`,
    `"${row.currency}"`,
    `"${row.amount}"`,
    `"${row.status}"`,
    `"${row.arrivalTs}"`
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((r: string[]) => r.join(','))
  ].join('\n')

  const date = new Date().toISOString().split('T')[0]
  await downloadCSV(csvContent, `payout-details-${payoutId.value}-${date}.csv`)
}

async function exportPayoutItems () {
  if (!payoutItemRows.value.length) { return }

  const headers = [
    $t('table.id'),
    $t('table.created'),
    $t('table.currency'),
    $t('table.commission_amount'),
    $t('common.description'),
    $t('table.status'),
    $t('table.metadata')
  ]

  const rows = payoutItemRows.value.map((row: any) => [
    `"${row.commissionId}"`,
    `"${row.createdTs}"`,
    `"${row.currency}"`,
    `"${row.amount}"`,
    `"${(row.description || '').replace(/"/g, '""')}"`,
    `"${row.status}"`,
    `"${(row.metadata || '').replace(/"/g, '""')}"`
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((r: string[]) => r.join(','))
  ].join('\n')

  const date = new Date().toISOString().split('T')[0]
  await downloadCSV(csvContent, `payout-items-${payoutId.value}-${date}.csv`)
}
</script>
