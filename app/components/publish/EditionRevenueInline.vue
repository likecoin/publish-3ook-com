<template>
  <!-- The same numbers as the full revenue card, cut to the two columns an
       author checks while typing a price: what a reader pays and what lands.
       The earnings column is the direct-link rate, since that is the link this
       page hands them. -->
  <div
    v-if="regionRows.length"
    class="rounded-lg border border-default bg-elevated/60 p-3"
  >
    <table class="w-full text-sm">
      <thead>
        <tr class="text-xs text-muted">
          <td />
          <th
            scope="col"
            class="text-right font-normal pb-1"
            v-text="$t('publish_review.revenue_reader_pays')"
          />
          <th
            scope="col"
            class="text-right font-normal pb-1 pl-3"
            v-text="$t('publish_review.revenue_you_earn')"
          />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in regionRows"
          :key="row.currency"
          class="border-t border-default"
        >
          <td
            class="py-1 text-muted"
            v-text="row.label"
          />
          <td
            class="py-1 text-right text-highlighted tabular-nums"
            v-text="row.readerPays"
          />
          <td
            class="py-1 pl-3 text-right text-highlighted tabular-nums"
            v-text="row.earnDirect"
          />
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { PriceFormItem } from '~/types/publish'

const { t: $t } = useI18n()

const { price } = defineProps<{
  price: PriceFormItem
}>()

const { regionRows } = useRegionRevenueRows(() => [price])
</script>
