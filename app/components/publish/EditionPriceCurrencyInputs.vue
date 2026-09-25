<template>
  <UFormField :label="$t('nft_book_form.custom_price_usd')">
    <UInput
      :model-value="usd"
      type="number"
      step="0.01"
      min="0"
      placeholder="0"
      @update:model-value="(v: string | number) => { usd = String(v ?? '') }"
    />
  </UFormField>
  <UFormField :label="$t('nft_book_form.custom_price_hkd')">
    <UInput
      :model-value="hkd"
      type="number"
      step="1"
      min="0"
      placeholder="0"
      @update:model-value="(v: string | number) => { hkd = String(v ?? '') }"
    />
  </UFormField>
  <UFormField :label="$t('nft_book_form.custom_price_twd')">
    <UInput
      :model-value="twd"
      type="number"
      step="1"
      min="0"
      placeholder="0"
      @update:model-value="(v: string | number) => { twd = String(v ?? '') }"
    />
  </UFormField>
</template>

<script setup lang="ts">
// The amount trio for the list price's custom mode. Only the rows: the host
// brings its own container and decides when to show them. USD steps by cents,
// the other two by whole units, which is the part that must not drift apart.
const { t: $t } = useI18n()

const usd = defineModel<string>('usd', { required: true })
const hkd = defineModel<string>('hkd', { required: true })
const twd = defineModel<string>('twd', { required: true })
</script>
