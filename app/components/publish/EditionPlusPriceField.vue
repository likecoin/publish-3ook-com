<template>
  <UFormField
    v-if="amounts.length"
    :label="$t('nft_book_form.plus_price_label')"
    :help="$t('nft_book_form.plus_price_help')"
  >
    <p
      class="text-sm font-medium"
      v-text="amounts.join(' · ')"
    />
  </UFormField>
</template>

<script setup lang="ts">
import type { PriceFormItem } from '~/types/publish'
import { isBlank } from '~/utils/listing-price'
import { CURRENCY_SYMBOL } from '~/utils/pricing'

const { t: $t } = useI18n()

// Read-only: the form only shows the member price and carries it through on
// save, since the edition PUT replaces the whole price object.
const { price } = defineProps<{
  price: PriceFormItem
}>()

const amounts = computed(() => ([
  ['usd', price.plusPriceUSDInput],
  ['hkd', price.plusPriceHKDInput],
  ['twd', price.plusPriceTWDInput],
] as const)
  .filter(([, input]) => !isBlank(input))
  .map(([currency, input]) => `${CURRENCY_SYMBOL[currency]}${input}`))
</script>
