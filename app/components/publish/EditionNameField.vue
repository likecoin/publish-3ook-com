<template>
  <UFormField
    :name="`prices.${index}.name`"
    :ui="{ container: 'space-y-2' }"
  >
    <template #label>
      {{ $t('nft_book_form.product_name') }}
      <ToolTips :image-style="{ width: '250px' }">
        <template #image>
          <img
            src="~/assets/images/hint/editionInfo-en.png"
            class="object-cover"
            alt=""
          >
        </template>
        <UIcon name="i-heroicons-question-mark-circle" />
      </ToolTips>
    </template>
    <UInput
      v-model="price.name"
      :placeholder="$t('nft_book_form.product_name_placeholder')"
    />
  </UFormField>
</template>

<script setup lang="ts">
import type { PriceFormItem } from '~/types/publish'

const { t: $t } = useI18n()

defineProps<{
  index: number
}>()

// The edition object is shared with the host's `prices` array and edited in
// place, as the form has always done; this only owns the markup.
const price = defineModel<PriceFormItem>('price', { required: true })
</script>
