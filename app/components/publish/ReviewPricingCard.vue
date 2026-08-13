<template>
  <UCard :ui="{ header: 'flex justify-between items-center' }">
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('publish_review.pricing_title')"
      />
      <UButton
        v-if="editable"
        variant="ghost"
        size="xs"
        icon="i-heroicons-pencil-square"
        :label="$t('publish_review.edit_section')"
        @click="emit('edit')"
      />
    </template>
    <ul class="space-y-2 text-sm">
      <li
        v-for="(p, index) in prices"
        :key="p.index || index"
        class="flex items-baseline gap-x-3 flex-wrap"
      >
        <span
          class="font-medium text-highlighted"
          v-text="p.name || $t('nft_book_form.product_name_placeholder')"
        />
        <span class="text-highlighted">
          {{ formatPrice(p) }}
          <span
            class="text-dimmed"
            v-text="p.deliveryMethod === 'auto'
              ? `(${$t('nft_book_form.unlimited')})`
              : `(${$t('nft_book_form.stock')}: ${p.stock})`"
          />
        </span>
      </li>
    </ul>
    <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      <template
        v-for="row in settingsRows"
        :key="row.label"
      >
        <dt
          class="text-muted"
          v-text="row.label"
        />
        <dd
          class="text-highlighted"
          v-text="row.value"
        />
      </template>
    </dl>
  </UCard>
</template>

<script setup lang="ts">
import type { PriceFormItem } from '~/types/publish'
import { getPriceItemUSDValue, formatPriceUSDLabel } from '~/utils/listing'

const { t: $t } = useI18n()

const {
  prices,
  isPlusReadingEnabled,
  hideAudio,
  isAdultOnly,
  editable = false,
} = defineProps<{
  prices: PriceFormItem[]
  isPlusReadingEnabled: boolean
  hideAudio: boolean
  isAdultOnly: boolean
  editable?: boolean
}>()

const emit = defineEmits<{ edit: [] }>()

// Tipping is stored per edition, so a plain yes/no would misreport a listing
// whose editions disagree; count them instead.
const tippingValue = computed(() => {
  const enabled = prices.filter(p => p.isAllowCustomPrice).length
  if (!enabled) { return $t('common.no') }
  if (enabled === prices.length) { return $t('common.yes') }
  return $t('publish_review.tipping_partial', { count: enabled, total: prices.length })
})

const settingsRows = computed(() => [
  {
    label: $t('nft_book_form.plus_reading'),
    value: isPlusReadingEnabled
      ? $t('nft_book_form.plus_reading_join')
      : $t('nft_book_form.plus_reading_skip'),
  },
  {
    label: $t('nft_book_form.ai_audio'),
    value: hideAudio
      ? $t('nft_book_form.ai_audio_forbid')
      : $t('nft_book_form.ai_audio_allow'),
  },
  {
    label: $t('nft_book_form.accept_tipping'),
    value: tippingValue.value,
  },
  {
    label: $t('nft_book_form.is_adult_only'),
    value: isAdultOnly ? $t('common.yes') : $t('common.no'),
  },
])

function formatPrice(p: PriceFormItem): string {
  return formatPriceUSDLabel(getPriceItemUSDValue(p), $t)
}
</script>
