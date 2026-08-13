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
              v-if="canAddEdition"
              icon="i-heroicons-plus"
              class="mb-[12px]"
              variant="outline"
              :color="prices.length >= MAX_EDITION_COUNT ? 'neutral' : 'primary'"
              :disabled="locked || prices.length >= MAX_EDITION_COUNT"
              :label="$t('form.add_edition')"
              @click="showAddEditionModal = true"
            />
          </UTooltip>
        </div>
      </div>
    </template>

    <!-- One edition is not a list to compare; the price form below already
         shows everything a single row would, so the table waits for a second. -->
    <UTable
      v-if="prices.length > 1"
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
            v-text="getListingPriceName(row.original.name)"
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
    <!-- The stock balance lives in a table row, so it needs somewhere else to
         go once the table is hidden; it is the number 鑄造更多庫存 acts on. -->
    <p
      v-if="prices.length <= 1 && hasManualEdition"
      class="p-4 text-sm text-muted"
      v-text="$t('table.stock_balance', { count: stockBalance })"
    />

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

    <!-- A dialog rather than a child route: cancelling has to leave the page
         exactly as it was, and a route made 取消 a navigation. -->
    <UModal
      v-model:open="showAddEditionModal"
      :title="$t('form.add_edition')"
      class="sm:max-w-7xl"
      :ui="{ body: 'p-4 sm:p-6' }"
    >
      <template #body>
        <BookStatusEditionCreateForm
          :class-id="classId"
          :edition-index="prices.length"
          :existing-names="existingEditionNames"
          :seed-price="seedPrice"
          :has-existing-signature-image="hasExistingSignatureImage"
          @submit="handleEditionCreated"
          @cancel="showAddEditionModal = false"
        />
      </template>
    </UModal>

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
import { getListingPriceName } from '~/utils/listing'
import { MAX_EDITION_COUNT } from '~/constant'

const { t: $t } = useI18n()

const apiFetch = useLikeCoApiFetch()
const { showSuccessToast } = useToastComposable()

const { classId, stockBalance = 0, locked = false, canAddEdition = false, hasExistingSignatureImage = false } = defineProps<{
  classId: string
  stockBalance?: number
  // Reorder/add/restock shift the indexes the pending-changes ledger is keyed
  // on, so they wait while edits are pending.
  locked?: boolean
  // Only the owner can sign for a new edition; the dialog no longer refetches
  // the listing to find that out for itself.
  canAddEdition?: boolean
  hasExistingSignatureImage?: boolean
}>()

const prices = defineModel<ClassListingPrice[]>('prices', { required: true })

const emit = defineEmits<{
  restocked: []
  added: []
  error: [message: string]
}>()

const isUpdatingPricesOrder = ref(false)
const showRestockModal = ref(false)
const showAddEditionModal = ref(false)

const existingEditionNames = computed(() => prices.value.map(price => getListingPriceName(price.name)))

// The new edition opens at the book's current price rather than the global
// default, since a second edition is nearly always a variation on the first.
const seedPrice = computed(() => {
  const first = prices.value[0]
  return first === undefined ? '' : String(first.price ?? '')
})

async function handleEditionCreated() {
  showAddEditionModal.value = false
  emit('added')
}

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

const hasManualEdition = computed(() => prices.value.some(price => !price.isAutoDeliver))

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
