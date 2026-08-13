<template>
  <!-- Author-facing, so it gets its own card rather than sitting under the
       reader preview, but it stays next to the price it derives from. -->
  <UCard v-if="regionRows.length">
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('publish_review.revenue_title')"
      />
    </template>
    <div class="flex flex-col gap-2">
      <table class="w-full text-sm">
        <thead>
          <!-- Both channels sit side by side rather than behind a toggle: comparing
               them is the point. The spanning header groups them so they do not read
               as additive; its centred label lands on the column boundary, so the
               divider is what stops it labelling the left column alone. -->
          <tr class="text-xs text-muted">
            <td colspan="2" />
            <th
              scope="colgroup"
              colspan="2"
              class="text-center font-normal pb-1 pl-4 border-b border-l border-default"
              v-text="$t('publish_review.revenue_you_earn')"
            />
          </tr>
          <tr class="text-xs text-muted">
            <th
              scope="col"
              class="text-left font-normal pb-1"
              v-text="$t('publish_review.revenue_region')"
            />
            <th
              scope="col"
              class="text-right font-normal pb-1 pr-4"
              v-text="$t('publish_review.revenue_reader_pays')"
            />
            <th
              scope="col"
              class="text-right font-normal pb-1 pl-4 border-l border-default"
              v-text="$t('publish_review.revenue_liker_land')"
            />
            <th
              scope="col"
              class="text-right font-normal pb-1 pl-4"
              v-text="$t('publish_review.revenue_direct')"
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
              class="py-1.5 text-muted"
              v-text="row.label"
            />
            <td
              class="py-1.5 pr-4 text-right text-highlighted tabular-nums"
              v-text="row.readerPays"
            />
            <td
              class="py-1.5 pl-4 text-right text-highlighted tabular-nums border-l border-default"
              v-text="row.earnLikerLand"
            />
            <td
              class="py-1.5 pl-4 text-right text-highlighted tabular-nums"
              v-text="row.earnDirect"
            />
          </tr>
        </tbody>
      </table>
      <p
        class="text-xs text-dimmed"
        v-text="$t('publish_review.revenue_note')"
      />
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { PriceFormItem } from '~/types/publish'

const { t: $t } = useI18n()

const { prices } = defineProps<{
  prices: PriceFormItem[]
}>()

const { regionRows } = useRegionRevenueRows(() => prices)
</script>
