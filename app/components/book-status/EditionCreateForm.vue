<template>
  <div class="flex flex-col gap-4">
    <AppErrorAlert v-model="error" />

    <!-- The cost of a second edition falls on the reader, who now has to
         choose before buying; say so before the author commits to one. -->
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-heroicons-information-circle"
      :description="$t('status_page.add_edition_consequence')"
    />

    <!-- Per-edition fields only; class-level listing settings live in the
         status page's Book details tab. -->
    <PublishPricingForm
      ref="pricingFormRef"
      v-model:prices="prices"
      v-model:signature-image="signatureImage"
      is-adding-edition
      :display-edit-index="displayEditIndex"
      :has-existing-signature-image="hasExistingSignatureImage"
      :name-placeholder="$t('nft_book_form.new_edition_name_placeholder')"
      :reserved-names="existingNames"
    />

    <div class="w-full flex justify-center gap-3">
      <UButton
        :label="$t('common.cancel')"
        color="neutral"
        variant="ghost"
        size="lg"
        :disabled="isLoading"
        @click="emit('cancel')"
      />
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
      :close="false"
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
import type { PriceFormItem } from '~/types/publish'
import { mapPriceFormItemsToPayload, createDefaultPriceFormItem } from '~/utils/listing'

const { t: $t } = useI18n()
const bookstoreApiStore = useBookstoreApiStore()
const { addEditionPrice, uploadSignImages } = bookstoreApiStore
const { showErrorToast } = useToastComposable()

const { classId, editionIndex, existingNames = [], seedPricing = {}, hasExistingSignatureImage = false } = defineProps<{
  classId: string
  editionIndex: string | number
  // Names the book's other editions already use, and the pricing fields to open
  // with, so a second edition starts from the first rather than the defaults.
  existingNames?: string[]
  seedPricing?: Partial<PriceFormItem>
  hasExistingSignatureImage?: boolean
}>()

const emit = defineEmits(['submit', 'cancel'])

const error = ref('')
const isLoading = ref(false)
const signatureImage = ref<File | null>(null)
const pricingFormRef = ref()

const displayEditIndex = computed(() => Number(editionIndex) + 1)

// The name stays blank, not prefilled: the old default named every new edition
// after the first one, which is exactly the name it must not have.
const prices = ref<PriceFormItem[]>([
  createDefaultPriceFormItem(seedPricing),
])

async function onSubmit() {
  try {
    // UForm surfaces validation errors inline on the offending fields.
    if (!(await pricingFormRef.value?.validate())) {
      return
    }
    const mapped = mapPriceFormItemsToPayload(prices.value)
    const price = mapped[0]

    isLoading.value = true
    await addEditionPrice(classId, editionIndex.toString(), { price })

    if (signatureImage.value) {
      const form = new FormData()
      form.append('signImage', signatureImage.value)
      await uploadSignImages(form, classId)
    }
    emit('submit')
  }
  catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    error.value = getApiErrorMessage(err, $t)
    showErrorToast(err)
  }
  finally {
    isLoading.value = false
  }
}
</script>
