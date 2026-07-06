<template>
  <UCard :ui="{ body: 'p-0' }">
    <template #header>
      <div class="flex justify-between items-center">
        <h3
          class="font-bold font-mono"
          v-text="$t('pages.editions')"
        />
        <div class="flex justify-between items-center gap-4">
          <UButton
            icon="i-heroicons-plus"
            class="mb-[12px]"
            variant="outline"
            :color="prices.length >= MAX_EDITION_COUNT ? 'neutral' : 'primary'"
            :disabled="prices.length >= MAX_EDITION_COUNT"
            :label="$t('form.add_edition')"
            :to="localeRoute({
              name: 'my-books-status-classId-edit-new',
              params: { classId },
              query: { price_index: prices.length },
            })"
          />
        </div>
      </div>
    </template>

    <UTable
      :columns="editionsTableColumns"
      :data="editionsTableRows"
    >
      <template #sort-cell="{ row }">
        <div
          v-if="!row.original.isStockBalancePlaceholderRow && prices.length > 1"
          class="flex flex-col gap-1"
        >
          <UButton
            :icon="row.original.originalIndex === 0 ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'"
            variant="ghost"
            color="neutral"
            size="xs"
            :label="String(row.original.originalIndex + 1)"
            :disabled="isUpdatingPricesOrder || (row.original.originalIndex <= 0 && row.original.originalIndex >= prices.length - 1)"
            :loading="isUpdatingPricesOrder"
            trailing
            @click="row.original.originalIndex === 0 ? movePriceDown(row.original.originalIndex) : movePriceUp(row.original.originalIndex)"
          />
        </div>
        <span
          v-if="!row.original.isStockBalancePlaceholderRow && prices.length === 1"
          v-text="String(row.original.originalIndex + 1)"
        />
      </template>
      <template #name-cell="{ row }">
        <h4
          class="font-medium"
          v-text="typeof row.original.name === 'object' ? row.original.name.zh : row.original.name"
        />
      </template>
      <template #delivery-cell="{ row }">
        <h4
          v-if="!row.original.isStockBalancePlaceholderRow"
          class="font-medium"
          v-text="row.original.isAutoDeliver ? $t('form.auto_delivery') : $t('form.manual_delivery')"
        />
      </template>
      <template #stock-cell="{ row }">
        <span class="text-right">
          {{ row.original.isAutoDeliver ? $t('form.auto_stock') : row.original.stock }}
        </span>
      </template>
      <template #price-cell="{ row }">
        <span class="text-right">
          {{ row.original.price }}
        </span>
      </template>
      <template #details-cell="{ row }">
        <UButton
          v-if="!row.original.isStockBalancePlaceholderRow"
          icon="i-heroicons-document"
          :to="localeRoute({
            name: 'my-books-status-classId-edit-editionIndex',
            params: { classId, editionIndex: String(row.original.index) },
          })"
          variant="soft"
          color="neutral"
        />
      </template>
    </UTable>
    <template #footer>
      <div class="flex justify-end items-center ">
        <UButton
          icon="i-heroicons-plus"
          :label="$t('buttons.mint_new_stock')"
          @click="showRestockModal = true"
        />
      </div>
    </template>

    <UModal v-model:open="showRestockModal">
      <template #content>
        <LiteMintNFT
          :is-restock="true"
          :restock-count="stockBalance"
          :iscn-id="classId"
          @submit="handleMintNFTSubmit"
        />
      </template>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
import type { ClassListingPrice, EditionTableRow } from '~/types'
import { MAX_EDITION_COUNT } from '~/constant'

const { t: $t } = useI18n()

const { LIKE_CO_API } = useRuntimeConfig().public
const bookstoreApiStore = useBookstoreApiStore()
const { token } = storeToRefs(bookstoreApiStore)
const localeRoute = useLocaleRoute()
const toast = useToast()

const { classId, userIsOwner = false, stockBalance = 0 } = defineProps<{
  classId: string
  userIsOwner?: boolean
  stockBalance?: number
}>()

const prices = defineModel<ClassListingPrice[]>('prices', { required: true })

const emit = defineEmits<{
  restocked: []
  error: [message: string]
}>()

const isUpdatingPricesOrder = ref(false)
const showRestockModal = ref(false)

const editionsTableColumns = computed(() => {
  const columns = []

  columns.push(
    { accessorKey: 'sort', header: $t('table.sort'), class: 'w-[60px]' },
    { accessorKey: 'name', header: $t('table.name') },
    {
      accessorKey: 'delivery',
      header: $t('table.delivery'),
      class: 'w-[120px]',
    },
    { accessorKey: 'stock', header: $t('table.stock'), class: 'w-[120px]' },
    { accessorKey: 'price', header: $t('table.price_usd'), class: 'w-[120px]' },
  )

  if (userIsOwner) {
    columns.push({ accessorKey: 'details', header: $t('table.details'), class: 'w-[80px]' })
  }

  return columns
})

const editionsTableRows = computed(() => {
  const rows: EditionTableRow[] = prices.value.map((element, index) => ({
    ...element,
    originalIndex: index,
    isStockBalancePlaceholderRow: false,
  }))

  // If it's a manual edition, add a row for stock balance.
  if (prices.value.some(price => !price.isAutoDeliver)) {
    rows.push({
      name: '',
      isAutoDeliver: false,
      stock: $t('table.stock_balance', { count: stockBalance }),
      price: '',
      isStockBalancePlaceholderRow: true,
      originalIndex: -1,
      index: -1,
      description: '',
      isAllowCustomPrice: false,
    })
  }

  return rows
})

async function movePriceUp(index: number) {
  if (index <= 0) { return }
  await movePrice(index, index - 1)
}

async function movePriceDown(index: number) {
  if (index >= prices.value.length - 1) { return }
  await movePrice(index, index + 1)
}

async function movePrice(fromIndex: number, toIndex: number) {
  try {
    isUpdatingPricesOrder.value = true

    const newPrices = [...prices.value]
    const [movedItem] = newPrices.splice(fromIndex, 1)
    if (!movedItem) { return }
    newPrices.splice(toIndex, 0, movedItem)
    const edition = prices.value[fromIndex]
    if (!edition) { return }
    const priceIndex = edition.index
    await $fetch(`${LIKE_CO_API}/likernft/book/store/${classId}/price/${priceIndex}/order`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token.value}`,
      },
      body: {
        order: toIndex,
      },
    })
    prices.value = newPrices.map((p, order) => ({ ...p, order }))
    toast.add({
      icon: 'i-heroicons-check-circle',
      title: 'Updated editions order successfully',
      duration: 2000,
      color: 'success',
    })
  }
  catch (err) {
    emit('error', (err as Error).toString())
  }
  finally {
    isUpdatingPricesOrder.value = false
  }
}

async function handleMintNFTSubmit() {
  emit('restocked')
  showRestockModal.value = false
}
</script>
