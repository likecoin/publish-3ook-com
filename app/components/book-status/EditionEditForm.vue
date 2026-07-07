<template>
  <div class="flex flex-col gap-4">
    <AppErrorAlert v-model="error" />

    <!-- Per-edition fields only; class-level listing settings live in the
         status page's Book details tab. -->
    <PublishPricingForm
      ref="pricingFormRef"
      v-model:prices="prices"
      v-model:settings="settings"
      v-model:signature-image="signatureImage"
      mode="edit"
      :display-edit-index="displayEditIndex"
      :has-existing-signature-image="hasExistingSignatureImage"
    />

    <div class="w-full flex justify-center">
      <UButton
        :label="$t('common.save')"
        :loading="isLoading"
        size="lg"
        :disabled="isLoading"
        @click="onSubmit"
      />
    </div>

    <UModal
      :open="!!isLoading"
      :dismissible="false"
      class="p-4 gap-2"
    >
      <template #body>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <UBadge variant="soft">
              {{ $t('common.loading') }}
            </UBadge>
            <p
              class="text-xs text-gray-500"
              v-text="$t('nft_book_form.loading_progress_text')"
            />
          </div>
          <UProgress
            animation="carousel"
            color="primary"
            class="w-full"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ClassListingData, ClassListingPrice } from '~/types'
import type { PriceFormItem, PricingFormSettings } from '~/types/publish'
import { mapPriceFormItemsToPayload, createDefaultPriceFormItem } from '~/utils/listing'

const { t: $t } = useI18n()
const apiFetch = useLikeCoApiFetch()
const bookstoreApiStore = useBookstoreApiStore()
const { updateEditionPrice, addEditionPrice, uploadSignImages } = bookstoreApiStore
const { wallet: sessionWallet } = storeToRefs(bookstoreApiStore)
const { showErrorToast } = useToastComposable()

const { classId, editionIndex, isNewEdition = false } = defineProps<{
  classId: string
  editionIndex: string | number
  isNewEdition?: boolean
}>()

const emit = defineEmits(['submit'])

const error = ref('')
const isLoading = ref(false)
const hasExistingSignatureImage = ref(false)
const signatureImage = ref<File | null>(null)
const pricingFormRef = ref()

const displayEditIndex = computed(() => Number(editionIndex) + 1)

const prices = ref<PriceFormItem[]>([
  createDefaultPriceFormItem({ name: $t('prices.standard_edition') }),
])

// Only isAllowCustomPrice is relevant in edit mode; the rest of the settings
// model is inert here.
const settings = ref<PricingFormSettings>({
  isAllowCustomPrice: true,
  isAdultOnly: false,
  hideAudio: false,
  isPlusReadingEnabled: false,
  tableOfContents: '',
  connectedWallets: null,
})

onMounted(async () => {
  try {
    isLoading.value = true
    const classResData = await apiFetch<ClassListingData>(`/likernft/book/store/${classId}`)
    if (!classResData) {
      throw new Error($t('errors.nft_class_not_found'))
    }
    if (classResData.ownerWallet !== sessionWallet.value) {
      throw new Error('NOT_OWNER_OF_NFT_CLASS')
    }
    if (classResData.enableSignatureImage) {
      hasExistingSignatureImage.value = true
    }

    if (!isNewEdition) {
      const currentEdition = classResData.prices.find(
        (e: ClassListingPrice) => e.index.toString() === editionIndex.toString(),
      )
      if (!currentEdition) {
        throw new Error('Edition not found')
      }
      const overrideHKD = currentEdition.priceInDecimalByCurrency?.hkd
      const overrideTWD = currentEdition.priceInDecimalByCurrency?.twd
      const hasExistingCustomPricing = typeof overrideHKD === 'number' || typeof overrideTWD === 'number'
      const tierPriceStr = currentEdition.price?.toString() || ''
      prices.value = [{
        price: tierPriceStr,
        deliveryMethod: currentEdition.isAutoDeliver ? 'auto' : 'manual',
        autoMemo: currentEdition.autoMemo || '',
        stock: currentEdition.stock,
        name: typeof currentEdition.name === 'object' ? currentEdition.name.zh || '' : currentEdition.name || '',
        description: typeof currentEdition.description === 'object' ? currentEdition.description.zh || '' : currentEdition.description || '',
        isAllowCustomPrice: currentEdition.isAllowCustomPrice,
        isListed: !currentEdition.isUnlisted,
        oldIsAutoDeliver: currentEdition.isAutoDeliver,
        oldStock: currentEdition.stock,
        isCustomPricing: hasExistingCustomPricing,
        priceUSDInput: hasExistingCustomPricing ? tierPriceStr : '',
        priceHKDInput: typeof overrideHKD === 'number' ? (overrideHKD / 100).toString() : '',
        priceTWDInput: typeof overrideTWD === 'number' ? (overrideTWD / 100).toString() : '',
      }]
      settings.value.isAllowCustomPrice = currentEdition.isAllowCustomPrice
    }
  }
  catch (e) {
    error.value = (e as Error).toString()
    // eslint-disable-next-line no-console
    console.error(e)
  }
  finally {
    isLoading.value = false
  }
})

async function onSubmit() {
  try {
    // UForm surfaces validation errors inline on the offending fields.
    if (!(await pricingFormRef.value?.validate())) {
      return
    }
    const mapped = mapPriceFormItemsToPayload(prices.value)
    const price = mapped[0]

    isLoading.value = true
    if (isNewEdition) {
      await addEditionPrice(classId, editionIndex.toString(), { price })
    }
    else {
      await updateEditionPrice(classId, editionIndex, { price })
    }

    if (signatureImage.value) {
      const form = new FormData()
      form.append('signImage', signatureImage.value)
      await uploadSignImages(form, classId)
      hasExistingSignatureImage.value = true
    }
    emit('submit')
  }
  catch (err) {
    const errorData = (err as { data?: string }).data || err
    // eslint-disable-next-line no-console
    console.error(errorData)
    error.value = String(errorData)
    showErrorToast(String(errorData))
  }
  finally {
    isLoading.value = false
  }
}
</script>
