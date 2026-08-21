<template>
  <UFormField
    :name="`prices.${index}.name`"
    :ui="{ container: 'space-y-2' }"
  >
    <template #label>
      {{ $t('nft_book_form.product_name') }}
      <ToolTips>
        <template #image>
          <img
            v-if="locale === 'en'"
            src="~/assets/images/hint/editionInfo-en.png"
            class="object-cover"
            alt=""
          >
          <img
            v-else
            src="~/assets/images/hint/editionInfo-zh.png"
            class="object-cover"
            alt=""
          >
        </template>
        <UIcon name="i-heroicons-question-mark-circle" />
      </ToolTips>
    </template>
    <UInput
      v-model="price.name"
      :placeholder="placeholder || $t('nft_book_form.product_name_placeholder')"
    />
  </UFormField>
</template>

<script setup lang="ts">
import type { PriceFormItem } from '~/types/publish'

const { t: $t, locale } = useI18n()

const { placeholder = '' } = defineProps<{
  index: number
  placeholder?: string
}>()

const price = defineModel<PriceFormItem>('price', { required: true })
</script>
