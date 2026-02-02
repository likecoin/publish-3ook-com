<template>
  <PageContainer :key="route.path">
    <PageHeader :title="pageTitle" />
    <PageBody
      :ui="{
        base: 'flex flex-col items-stretch grow space-y-4',
        padding: 'max-md:!px-0 max-md:py-0',
      }"
    >
      <UCard
        :ui="{
          base: 'flex flex-col grow',
          rounded: 'max-md:rounded-none',
          header: { base: 'flex justify-between items-center gap-4' },
          body: { base: 'grow', padding: '' },
          footer: {
            base: 'sticky bottom-0 bg-white dark:bg-gray-900 rounded-b-[inherit]',
            padding: 'px-0 sm:px-0 space-y-4',
          },
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

          <UDropdown
            :items="dropdownMenuItems"
            :popper="{ placement: 'bottom-end' }"
          >
            <UButton color="white" icon="i-heroicons-ellipsis-horizontal-circle" />
          </UDropdown>
        </template>

        <UTable
          v-model="selectedSaleItemTableRows"
          :columns="saleItemTableColumns"
          :rows="saleItemTableRows"
          :ui="{ wrapper: 'static h-full', thead: 'sticky top-0' }"
        >
          <template #name-data="{ row }">
            <div class="flex items-start gap-4">
              <img
                v-if="row.image"
                class="w-[64px] object-contain rounded-sm"
                :src="row.image"
                alt="Item image"
              >

              <div class="flex flex-col justify-start">
                <div class="whitespace-break-spaces" v-text="row.name" />

                <USelect
                  v-if="!!row.classId && row.prices?.length > 1"
                  class="mt-2"
                  :model-value="saleItemList[row.index].priceIndex || 0"
                  :options="row.prices?.map((price: any) => ({
                    label: price.name?.zh || price.name?.en || price.name,
                    value: price.index
                  }))"
                  @update:model-value="changePriceIndex($event, row)"
                />
              </div>
            </div>
          </template>
          <template #delete-action-header>
            <div class="text-center">
              <UIcon name="i-heroicons-trash-solid" />
            </div>
          </template>
          <template #delete-action-data="{ row }">
            <UButton
              icon="i-heroicons-x-mark"
              color="red"
              variant="link"
              @click="removeSaleItem(row)"
            />
          </template>
        </UTable>

        <template #footer>
          <div class="flex items-center gap-2 px-4 sm:px-6">
            <USelect
              v-model="selectedCouponCode"
              class="grow"
              :options="coupons.map(coupon => ({
                label: coupon.name,
                value: coupon.code
              }))"
              :placeholder="$t('sales_pos.select_coupon')"
            />

            <UButton
              v-if="selectedCouponCode"
              icon="i-heroicons-x-mark-16-solid"
              size="sm"
              color="gray"
              variant="outline"
              @click="() => { selectedCouponCode = '' }"
            />
          </div>

          <UDivider />

          <UTabs
            class="w-full"
            :items="[
              { key: 'direct', label: $t('sales_pos.direct_checkout') },
            ]"
            :ui="{
              wrapper: 'px-4 sm:px-6',
              base: 'flex flex-col space-y-4'
            }"
          >
            <template #item="{ item }">
              <template v-if="item.key === 'direct'">
                <UFormGroup :label="$t('sales_pos.checkout_url')">
                  <div class="flex items-center gap-2">
                    <UInput
                      v-model="checkoutUrl"
                      class="grow font-mono"
                      readonly
                    />
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      variant="soft"
                      color="gray"
                      @click="copyCartUrl"
                    />
                  </div>
                </UFormGroup>

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
                    v-model="isOpenQRCodeModal"
                    :ui="{
                      padding: 'p-0',
                      rounded: 'max-sm:rounded-b-none'
                    }"
                  >
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
                          color="gray"
                          variant="ghost"
                          @click="isOpenQRCodeModal = false"
                        />
                      </template>
                    </QRCodeGenerator>
                  </UModal>
                </div>
              </template>
            </template>
          </UTabs>
        </template>
      </UCard>

      <UModal
        v-model="isShowAddItemModal"
        :ui="{
          padding: 'p-0',
          rounded: 'max-sm:rounded-b-none',
        }"
      >
        <UCard
          :ui="{
            rounded: 'max-sm:rounded-b-none',
            header: { base: 'flex justify-between items-center gap-4' },
            body: { base: 'space-y-4' },
            footer: { base: 'flex justify-center items-center' }
          }"
        >
          <template #header>
            <h3 class="font-bold font-mono" v-text="'Add Item(s)'" />

            <UButton
              icon="i-heroicons-x-mark"
              color="gray"
              variant="link"
              @click="toggleAddItemModal"
            />
          </template>
          <UFormGroup
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
          </UFormGroup>

          <div class="flex justify-center gap-4">
            <UButton
              icon="i-heroicons-plus-circle"
              :label="$t('sales_pos.add')"
              variant="outline"
              @click="addNewItemInput"
            />
          </div>

          <template #footer>
            <UButton
              label="Confirm"
              @click="addSaleItem"
            />
          </template>
        </UCard>
      </UModal>

      <UModal
        v-model="isOpenNewCouponModal"
        :ui="{
          padding: 'p-0',
          rounded: 'max-sm:rounded-b-none',
        }"
      >
        <UCard
          :ui="{
            rounded: 'max-sm:rounded-b-none',
            header: { base: 'flex justify-between items-center gap-4' },
            body: { base: 'space-y-4' },
            footer: { base: 'flex justify-end items-center gap-4' }
          }"
        >
          <template #header>
            <h3 class="font-bold" v-text="'Add Coupon'" />

            <UButton
              icon="i-heroicons-x-mark-16-solid"
              color="gray"
              size="xl"
              :padded="false"
              variant="link"
              @click="isOpenNewCouponModal = false"
            />
          </template>

          <UFormGroup
            label="Coupon Name"
            help="For POS Display Only"
            :required="true"
          >
            <UInput
              v-model="newCouponNameInput"
              placeholder="Fall Promotion"
            />
          </UFormGroup>

          <UFormGroup
            label="Coupon Code"
            :required="true"
          >
            <UInput
              v-model="newCouponCodeInput"
              class="font-mono"
              placeholder="FALLPROMO"
            />
          </UFormGroup>

          <template #footer>
            <UButton
              icon="i-heroicons-plus-circle"
              label="Add Coupon"
              :disabled="!newCouponNameInput || !newCouponCodeInput"
              @click="addCouponCode"
            />
          </template>
        </UCard>
      </UModal>
    </PageBody>
  </PageContainer>
</template>

<script setup lang="ts">
import type { DropdownItem } from '#ui/types'
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

const saleItemList = ref<any[]>([])
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
    { key: 'name', label: $t('common.name'), class: '' }
  ]
  if (isEditMode.value) {
    columns.push({ key: 'delete-action', label: '', class: 'w-12' })
  }
  return columns
})

const dropdownMenuItems = computed(() => {
  const items: DropdownItem[][] = []

  if (saleItemTableRows.value.length) {
    items.push([{
      label: isEditMode.value ? 'Exit Edit Items' : 'Edit Items',
      icon: isEditMode.value ? 'i-heroicons-pencil-solid' : 'i-heroicons-pencil',
      click: toggleEditMode
    }])
  }

  items.push([
    {
      label: 'New Coupon',
      icon: 'i-heroicons-tag',
      click: () => {
        isOpenNewCouponModal.value = !isOpenNewCouponModal.value
      }
    },
    {
      class: 'text-red-500',
      label: 'Clear All Coupons',
      icon: 'i-heroicons-trash',
      iconClass: 'text-red-500',
      disabled: !coupons.value.length,
      click: clearAllCoupons
    }
  ])

  return items
})

interface SaleItem {
  classId?: string;
  prices?: any[];
  name: string;
  image: string;
  index: number;
}

const saleItemTableRows = computed<SaleItem[]>(() => {
  return saleItemList.value?.map((item, index) => {
    return {
      classId: item.classId,
      name: nftStore.getClassMetadataById(item.classId)?.name,
      prices: nftStore.getClassListingInfoById(item.classId)?.prices?.map((price: any) => ({ ...price })),
      image: parseImageURLFromMetadata(nftStore.getClassMetadataById(item.classId)?.data?.metadata?.image),
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
  const productsString = selectedItems.value.map(({ classId, priceIndex }) => {
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
        .map((item: any) => ({
          classId: item.classId,
          priceIndex: item.priceIndex
        }))
    }
    const storedCouponString = window.localStorage.getItem('nft_book_store_pos_coupons')
    if (storedCouponString) {
      const items = JSON.parse(storedCouponString)
      coupons.value = items
        .map((item: any) => ({
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
  saleItemList.value[index].priceIndex = Number(value)
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
    timeout: 2000,
    color: 'green'
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
      timeout: 2000,
      color: 'red'
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
  toast.add({ title: 'Copied URL to clipboard', timeout: 2000 })
  navigator.clipboard.writeText(checkoutUrl.value)
}

function goToCartUrl () {
  window.open(checkoutUrl.value)
}

function generateQRCode () {
  isOpenQRCodeModal.value = true
}

</script>
