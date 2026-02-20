<template>
  <PageContainer :key="route.path">
    <PageHeader :title="pageTitle" />
    <PageBody
      :ui="{
        base: 'flex flex-col items-stretch grow space-y-4',
        padding: 'max-md:px-0! max-md:py-0',
      }"
    >
      <UCard
        class="max-md:rounded-none"
        :ui="{
          root: 'flex flex-col grow',
          header: 'flex justify-between items-center gap-4',
          body: 'grow p-0',
          footer: 'sticky bottom-0 bg-white dark:bg-gray-900 rounded-b-[inherit] px-0 sm:px-0 space-y-4',
        }"
      >
        <template #header>
          <div class="flex items-center gap-2">
            <h2
              class="text-xl font-bold"
              v-text="$t('sales_pos.sales_items') + (selectedItems.length > 0 ? $t('sales_pos.selected_count', { count: selectedItems.length }) : '')"
            />

            <UButton
              icon="i-heroicons-plus-circle"
              variant="soft"
              @click="toggleAddItemModal"
            />
          </div>

          <UDropdownMenu
            :items="dropdownMenuItems"
            :popper="{ placement: 'bottom-end' }"
          >
            <UButton color="neutral" variant="outline" icon="i-heroicons-ellipsis-horizontal-circle" />
          </UDropdownMenu>
        </template>

        <UTable
          :columns="saleItemTableColumns"
          :data="saleItemTableRows"
          :ui="{ root: 'static h-full', thead: 'sticky top-0' }"
          @select="(row: TableRow<SaleItem>) => {
            const idx = selectedSaleItemTableRows.findIndex(r => r.index === row.original.index)
            if (idx >= 0) {
              selectedSaleItemTableRows.splice(idx, 1)
            } else {
              selectedSaleItemTableRows.push(row.original)
            }
          }"
        >
          <template #name-cell="{ row }">
            <div class="flex items-start gap-4">
              <img
                v-if="row.original.image"
                class="w-[64px] object-contain rounded-sm"
                :src="row.original.image"
                alt="Item image"
              >

              <div class="flex flex-col justify-start">
                <div class="whitespace-break-spaces" v-text="row.original.name" />

                <USelect
                  v-if="!!row.original.classId && (row.original.prices?.length ?? 0) > 1"
                  class="mt-2"
                  :model-value="saleItemList[row.original.index]?.priceIndex || 0"
                  :items="getPriceSelectItems(row.original.prices)"
                  @update:model-value="changePriceIndex($event, row.original)"
                />
              </div>
            </div>
          </template>
          <template #delete-action-header>
            <div class="text-center">
              <UIcon name="i-heroicons-trash-solid" />
            </div>
          </template>
          <template #delete-action-cell="{ row }">
            <UButton
              icon="i-heroicons-x-mark"
              color="error"
              variant="link"
              @click="removeSaleItem(row.original)"
            />
          </template>
        </UTable>

        <template #footer>
          <div class="flex items-center gap-2 px-4 sm:px-6">
            <USelect
              v-model="selectedCouponCode"
              class="grow"
              :items="coupons.map(coupon => ({
                label: coupon.name,
                value: coupon.code
              }))"
              :placeholder="$t('sales_pos.select_coupon')"
            />

            <UButton
              v-if="selectedCouponCode"
              icon="i-heroicons-x-mark-16-solid"
              size="sm"
              color="neutral"
              variant="outline"
              @click="() => { selectedCouponCode = '' }"
            />
          </div>

          <USeparator />

          <UTabs
            class="w-full"
            :items="[
              { value: 'direct', label: $t('sales_pos.direct_checkout') },
            ]"
            :ui="{
              root: 'px-4 sm:px-6',
              content: 'flex flex-col space-y-4'
            }"
          >
            <template #content="{ item }">
              <template v-if="item.value === 'direct'">
                <UFormField :label="$t('sales_pos.checkout_url')">
                  <div class="flex items-center gap-2">
                    <UInput
                      v-model="checkoutUrl"
                      class="grow font-mono"
                      readonly
                    />
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      variant="soft"
                      color="neutral"
                      @click="copyCartUrl"
                    />
                  </div>
                </UFormField>

                <div class="flex justify-center items-center gap-4">
                  <UButton
                    :label="$t('sales_pos.view_cart')"
                    size="lg"
                    @click="goToCartUrl"
                  />

                  <UButton
                    :label="$t('sales_pos.generate_qr_code')"
                    :disabled="!selectedItems.length"
                    size="lg"
                    @click="generateQRCode"
                  />
                  <UModal
                    v-model:open="isOpenQRCodeModal"
                  >
                    <template #content>
                      <QRCodeGenerator
                        :data="checkoutUrl"
                        mode="readonly"
                        file-name="likerland_checkout"
                        :width="280"
                        :height="280"
                      >
                        <template #header>
                          <h3 class="font-bold font-mono" v-text="'Scan to buy'" />
                          <UButton
                            icon="i-heroicons-x-mark"
                            color="neutral"
                            variant="ghost"
                            @click="isOpenQRCodeModal = false"
                          />
                        </template>
                      </QRCodeGenerator>
                    </template>
                  </UModal>
                </div>
              </template>
            </template>
          </UTabs>
        </template>
      </UCard>

      <UModal v-model:open="isShowAddItemModal">
        <template #header>
          <h3 class="font-bold font-mono" v-text="'Add Item(s)'" />

          <UButton
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="link"
            @click="toggleAddItemModal"
          />
        </template>

        <template #body>
          <div class="space-y-4">
            <UFormField
              v-for="(input, index) in newProductIdInputs"
              :key="`input-${input.id}`"
              :label="$t('sales_pos.enter_product_id_urls')"
              :required="true"
              :error="input.error?.message"
            >
              <div class="flex items-center gap-2">
                <UInput
                  class="grow font-mono"
                  :model-value="input.value"
                  placeholder="https://3ook.com/store/0x...."
                  @update:model-value="handleNewItemInputUpdate(index, $event)"
                />

                <UButton
                  v-if="newProductIdInputs.length > 1"
                  icon="i-heroicons-x-circle"
                  variant="link"
                  @click="deleteNewItemInput(index)"
                />
              </div>
            </UFormField>

            <div class="flex justify-center gap-4">
              <UButton
                icon="i-heroicons-plus-circle"
                :label="$t('sales_pos.add')"
                variant="outline"
                @click="addNewItemInput"
              />
            </div>
          </div>
        </template>

        <template #footer>
          <UButton
            label="Confirm"
            @click="addSaleItem"
          />
        </template>
      </UModal>

      <UModal v-model:open="isOpenNewCouponModal">
        <template #header>
          <h3 class="font-bold" v-text="'Add Coupon'" />

          <UButton
            icon="i-heroicons-x-mark-16-solid"
            color="neutral"
            size="xl"
            variant="link"
            @click="isOpenNewCouponModal = false"
          />
        </template>

        <template #body>
          <div class="space-y-4">
            <UFormField
              label="Coupon Name"
              help="For POS Display Only"
              :required="true"
            >
              <UInput
                v-model="newCouponNameInput"
                placeholder="Fall Promotion"
              />
            </UFormField>

            <UFormField
              label="Coupon Code"
              :required="true"
            >
              <UInput
                v-model="newCouponCodeInput"
                class="font-mono"
                placeholder="FALLPROMO"
              />
            </UFormField>
          </div>
        </template>

        <template #footer>
          <UButton
            icon="i-heroicons-plus-circle"
            label="Add Coupon"
            :disabled="!newCouponNameInput || !newCouponCodeInput"
            @click="addCouponCode"
          />
        </template>
      </UModal>
    </PageBody>
  </PageContainer>
</template>

<script setup lang="ts">
import type { DropdownMenuItem, TableRow } from '#ui/types'
const { t: $t } = useI18n()

const route = useRoute()
const toast = useToast()
const { BOOK3_URL } = useRuntimeConfig().public
const nftStore = useNftStore()

const { lazyFetchClassMetadataById, lazyFetchClassListingInfoById } = nftStore

const newProductIdInputs = ref<{ id: number; value: string, error?: Error }[]>([{ id: 0, value: '' }])
const newProductIdInputNextId = ref(1)

const isOpenNewCouponModal = ref(false)
const newCouponNameInput = ref('')
const newCouponCodeInput = ref('')
const coupons = ref<{name: string, code: string}[]>([])
const selectedCouponCode = ref('')

const saleItemList = ref<{ classId: string; priceIndex?: number }[]>([])
const isShowAddItemModal = ref(false)
const isOpenQRCodeModal = ref(false)
const isEditMode = ref(false)

watch(isShowAddItemModal, (value) => {
  if (!value) {
    newProductIdInputs.value = [{ id: 0, value: '' }]
    newProductIdInputNextId.value = 1
  }
})

const saleItemTableColumns = computed(() => {
  const columns = [
    { accessorKey: 'name', header: $t('common.name'), class: '' }
  ]
  if (isEditMode.value) {
    columns.push({ accessorKey: 'delete-action', header: '', class: 'w-12' })
  }
  return columns
})

const dropdownMenuItems = computed(() => {
  const items: DropdownMenuItem[][] = []

  if (saleItemTableRows.value.length) {
    items.push([{
      label: isEditMode.value ? 'Exit Edit Items' : 'Edit Items',
      icon: isEditMode.value ? 'i-heroicons-pencil-solid' : 'i-heroicons-pencil',
      onSelect: toggleEditMode
    }])
  }

  items.push([
    {
      label: 'New Coupon',
      icon: 'i-heroicons-tag',
      onSelect: () => {
        isOpenNewCouponModal.value = !isOpenNewCouponModal.value
      }
    },
    {
      class: 'text-red-500',
      label: 'Clear All Coupons',
      icon: 'i-heroicons-trash',
      disabled: !coupons.value.length,
      onSelect: clearAllCoupons
    }
  ])

  return items
})

interface SaleItem {
  classId?: string;
  prices?: Record<string, unknown>[];
  name: string;
  image: string;
  index: number;
}

function getPriceSelectItems (prices?: Record<string, unknown>[]) {
  if (!prices) { return [] }
  return prices.map((price) => {
    const name = price.name as { zh?: string; en?: string } | string | undefined
    return {
      label: (typeof name === 'object' ? (name?.zh || name?.en) : name) || '',
      value: (price.index as number) || 0
    }
  })
}

const saleItemTableRows = computed<SaleItem[]>(() => {
  return saleItemList.value?.map((item, index) => {
    const listingInfo = nftStore.getClassListingInfoById(item.classId)
    const listingPrices = listingInfo?.prices as Record<string, unknown>[] | undefined
    const metadata = nftStore.getClassMetadataById(item.classId)
    const imageData = (metadata as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined
    const nestedMetadata = imageData?.metadata as Record<string, unknown> | undefined
    return {
      classId: item.classId,
      name: metadata?.name || '',
      prices: listingPrices?.map((price: Record<string, unknown>) => ({ ...price })),
      image: parseImageURLFromMetadata((nestedMetadata?.image as string) || ''),
      index
    }
  })
})
const selectedSaleItemTableRows = ref<SaleItem[]>([])

const selectedItems = computed(() => {
  const items = selectedSaleItemTableRows.value.map(row => saleItemList.value[row.index])
  return items.sort((a, b) => {
    if (a?.priceIndex !== undefined && !b?.priceIndex) {
      return -1
    } else if (!a?.priceIndex && b?.priceIndex !== undefined) {
      return 1
    } else {
      return 0
    }
  })
})

watch(saleItemTableRows, (rows) => {
  if (!rows.length) {
    isEditMode.value = false
  }
})

const checkoutUrl = computed(() => {
  const params = new URLSearchParams({
    utm_source: 'direct-checkout',
    utm_medium: 'pos'
  })
  const productsString = selectedItems.value
    .filter((item): item is { classId: string; priceIndex?: number } => !!item)
    .map(({ classId, priceIndex }) => {
      return `${classId}${priceIndex ? `:${priceIndex}` : ''}`
    }).join(',')
  params.append('products', productsString)
  if (selectedCouponCode.value) {
    params.append('coupon', selectedCouponCode.value)
  }
  return `${BOOK3_URL}/checkout?${params.toString()}`
})

const pageTitle = computed(() => '3ook Point Of Sale')
useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value
})

onMounted(() => {
  try {
    const storedItemString = window.localStorage.getItem('nft_book_store_pos_items')
    if (storedItemString) {
      const items = JSON.parse(storedItemString)
      saleItemList.value = items
        .map((item: { classId: string; priceIndex?: number }) => ({
          classId: item.classId,
          priceIndex: item.priceIndex
        }))
    }
    const storedCouponString = window.localStorage.getItem('nft_book_store_pos_coupons')
    if (storedCouponString) {
      const items = JSON.parse(storedCouponString)
      coupons.value = items
        .map((item: { name: string; code: string }) => ({
          name: item.name,
          code: item.code
        }))
    }
  } catch (e) {
    console.error(e)
  }
  saleItemList.value.forEach((item) => {
    if (item.classId) {
      lazyFetchClassMetadataById(item.classId)
      lazyFetchClassListingInfoById(item.classId)
    }
  })
})

function addNewItemInput () {
  if (newProductIdInputs.value.length) {
    newProductIdInputs.value.push({ id: newProductIdInputNextId.value++, value: '' })
  }
}

function deleteNewItemInput (index: number) {
  newProductIdInputs.value.splice(index, 1)
}

function handleNewItemInputUpdate (index: number, value: string) {
  const input = newProductIdInputs.value[index]
  if (input) {
    input.error = undefined
    input.value = value
  }
}

function addSaleItem () {
  newProductIdInputs.value.forEach((input) => {
    input.error = undefined
    let productId = input.value.trim()
    if (productId.startsWith('http')) {
      const url = new URL(productId)
      productId = url.pathname.split('/').pop() || ''
    }
    if (productId.startsWith('0x')) {
      saleItemList.value.push({ classId: productId, priceIndex: 0 })
      lazyFetchClassMetadataById(productId)
      lazyFetchClassListingInfoById(productId)
    } else {
      input.error = new Error('Invalid product ID')
    }
  })
  if (newProductIdInputs.value.every(input => !input.error)) {
    isShowAddItemModal.value = false
    saveSaleProductIds()
  }
}

function changePriceIndex (value: number, { index }: { index: number }) {
  const item = saleItemList.value[index]
  if (item) {
    item.priceIndex = Number(value)
  }
  saveSaleProductIds()
}

function removeSaleItem ({ index }: { index: number }) {
  saleItemList.value.splice(index, 1)
  selectedSaleItemTableRows.value = selectedSaleItemTableRows.value.filter(row => row.index !== index)
  saveSaleProductIds()
}

function toggleAddItemModal () {
  isShowAddItemModal.value = !isShowAddItemModal.value
}

function toggleEditMode () {
  isEditMode.value = !isEditMode.value
}

function addCouponCode () {
  coupons.value.push({ name: newCouponNameInput.value, code: newCouponCodeInput.value })
  newCouponNameInput.value = ''
  newCouponCodeInput.value = ''
  saveSaleCoupons()
  toast.add({
    title: 'Added coupon',
    duration: 2000,
    color: 'success'
  })
  isOpenNewCouponModal.value = false
}

function clearAllCoupons () {
  const isConfirm = window.confirm('Are you sure you want to clear all coupons?')
  if (isConfirm) {
    coupons.value = []
    selectedCouponCode.value = ''
    saveSaleCoupons()
    toast.add({
      title: 'Cleared all coupons',
      duration: 2000,
      color: 'error'
    })
  }
}

function saveSaleProductIds () {
  window.localStorage.setItem('nft_book_store_pos_items', JSON.stringify(saleItemList.value))
}

function saveSaleCoupons () {
  window.localStorage.setItem('nft_book_store_pos_coupons', JSON.stringify(coupons.value))
}

function copyCartUrl () {
  copyToClipboard(checkoutUrl.value)
}

function goToCartUrl () {
  window.open(checkoutUrl.value)
}

function generateQRCode () {
  isOpenQRCodeModal.value = true
}

</script>
