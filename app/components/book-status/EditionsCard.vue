<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex justify-between items-center">
        <h3
          class="font-bold font-mono"
          v-text="$t('pages.editions')"
        />
        <div class="flex justify-between items-center gap-4">
          <UTooltip
            :text="$t('status_page.structural_locked_hint')"
            :disabled="!locked"
          >
            <UButton
              icon="i-heroicons-plus"
              class="mb-[12px]"
              variant="outline"
              :color="prices.length >= MAX_EDITION_COUNT ? 'neutral' : 'primary'"
              :disabled="locked || prices.length >= MAX_EDITION_COUNT"
              :label="$t('form.add_edition')"
              :to="locked ? undefined : localeRoute({
                name: 'my-books-status-classId-edit-new',
                params: { classId },
                query: { price_index: prices.length },
              })"
            />
          </UTooltip>
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
            :disabled="locked || isUpdatingPricesOrder || (row.original.originalIndex <= 0 && row.original.originalIndex >= prices.length - 1)"
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
        <div class="flex items-center gap-2">
          <h4
            class="font-medium"
            v-text="typeof row.original.name === 'object' ? row.original.name.zh : row.original.name"
          />
          <!-- Hidden is not off: the edition still sells through a purchase
               link, so it reads as information rather than a warning. -->
          <UBadge
            v-if="row.original.isUnlisted && !row.original.isStockBalancePlaceholderRow"
            color="info"
            variant="subtle"
            size="sm"
            :label="$t('nft_book_form.edition_visibility_hide')"
          />
        </div>
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
    </UTable>
    <template #footer>
      <div class="flex justify-end items-center ">
        <UTooltip
          :text="$t('status_page.structural_locked_hint')"
          :disabled="!locked"
        >
          <UButton
            icon="i-heroicons-plus"
            :label="$t('buttons.mint_new_stock')"
            :disabled="locked"
            @click="showRestockModal = true"
          />
        </UTooltip>
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

const apiFetch = useLikeCoApiFetch()
const localeRoute = useLocaleRoute()
const { showSuccessToast } = useToastComposable()

const { classId, stockBalance = 0, locked = false } = defineProps<{
  classId: string
  stockBalance?: number
  // Reorder/add/restock shift the indexes the pending-changes ledger is keyed
  // on, so they wait while edits are pending.
  locked?: boolean
}>()

const prices = defineModel<ClassListingPrice[]>('prices', { required: true })

const emit = defineEmits<{
  restocked: []
  error: [message: string]
}>()

const isUpdatingPricesOrder = ref(false)
const showRestockModal = ref(false)

const editionsTableColumns = computed(() => [
  { accessorKey: 'sort', header: $t('table.sort'), class: 'w-[60px]' },
  { accessorKey: 'name', header: $t('table.name') },
  {
    accessorKey: 'delivery',
    header: $t('table.delivery'),
    class: 'w-[120px]',
  },
  { accessorKey: 'stock', header: $t('table.stock'), class: 'w-[120px]' },
  { accessorKey: 'price', header: $t('table.price_usd'), class: 'w-[120px]' },
])

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
    await apiFetch(`/likernft/book/store/${classId}/price/${priceIndex}/order`, {
      method: 'PUT',
      body: {
        order: toIndex,
      },
    })
    prices.value = newPrices.map((p, order) => ({ ...p, order }))
    showSuccessToast($t('pages.updated_editions_order'))
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
