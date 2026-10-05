<template>
  <UFormField
    :name="`prices.${index}.price`"
    :label="$t('nft_book_form.unit_price_label')"
    :help="ladderHint"
  >
    <div class="space-y-3">
      <UCheckbox
        v-if="shouldShowCustomPricingUI"
        v-model="price.isCustomPricing"
        :label="$t('nft_book_form.use_custom_pricing')"
        @update:model-value="(v: boolean | 'indeterminate') => onCustomPricingToggle(v === true)"
      />
      <USelect
        v-if="!price.isCustomPricing"
        v-model="price.price"
        class="w-full"
        :items="USD_PRICING_OPTIONS"
        :placeholder="$t('nft_book_form.price_placeholder')"
        value-key="value"
      />
      <div
        v-else
        class="flex flex-col gap-3 p-3 bg-elevated rounded-lg"
      >
        <p class="text-xs text-muted">
          {{ $t('nft_book_form.custom_pricing_description') }}
        </p>
        <PublishEditionPriceCurrencyInputs
          v-model:usd="price.priceUSDInput"
          v-model:hkd="price.priceHKDInput"
          v-model:twd="price.priceTWDInput"
        />
      </div>
    </div>
  </UFormField>
</template>

<script setup lang="ts">
import { USD_PRICING_OPTIONS } from '~/constant'
import type { PriceFormItem } from '~/types/publish'

const { t: $t } = useI18n()

const { showLadderHint = false } = defineProps<{
  index: number
  showLadderHint?: boolean
}>()

const price = defineModel<PriceFormItem>('price', { required: true })

const route = useRoute()

// Backdoor: ?advanced_pricing=1 reveals the custom USD/HKD/TWD pricing UI.
const shouldShowCustomPricingUI = computed(() => (
  route.query.advanced_pricing === '1' || price.value.isCustomPricing
))

function onCustomPricingToggle(enabled: boolean) {
  if (enabled && price.value.priceUSDInput === '' && price.value.price) {
    price.value.priceUSDInput = price.value.price
  }
}

// Names the rung the author picked, so a select of forty near-identical
// numbers reads as a ladder position rather than an arbitrary amount.
const ladderHint = computed(() => {
  if (!showLadderHint || price.value.isCustomPricing) { return undefined }
  const rung = USD_PRICING_OPTIONS.findIndex(option => option.value === price.value.price)
  if (rung < 1) { return undefined }
  return $t('nft_book_form.price_ladder_hint', { rung })
})
</script>
