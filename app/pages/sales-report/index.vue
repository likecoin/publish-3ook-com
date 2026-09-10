<template>
  <PageContainer>
    <PageHeader :title="$t('menu.sales_report')" />

    <div class="sticky top-16 z-10 bg-default border-b border-default">
      <UTabs
        v-model="selectedTabValue"
        :items="tabItems"
        :content="false"
        class="w-full max-w-5xl mx-auto px-4 py-3"
      />
    </div>

    <PageBody>
      <SalesReportPlusReading v-if="selectedTabValue === 'plus'" />
      <SalesReportPayoutHistory v-else-if="selectedTabValue === 'payout'" />
      <SalesReportCommissionHistory v-else />
    </PageBody>
  </PageContainer>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

const tabItems = computed(() => [
  { label: $t('user_settings.commission_history'), value: 'commission' },
  { label: $t('plus_reading_report.title'), value: 'plus' },
  { label: $t('user_settings.payout_history'), value: 'payout' },
])

const selectedTabValue = ref('commission')
</script>
