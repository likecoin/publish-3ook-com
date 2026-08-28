<template>
  <PageContainer>
    <PageHeader :title="$t('menu.sales_report')" />
    <PageBody>
      <UTabs
        v-model="selectedTabItemIndex"
        class="w-full"
        :items="tabItems"
      >
        <template #content="{ item }">
          <SalesReportPlusReading
            v-if="item.value === 'plus'"
            :key="item.value"
          />
          <SalesReportCommissionHistory
            v-else
            :key="item.value"
          />
        </template>
      </UTabs>
    </PageBody>
  </PageContainer>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

const tabItems = computed(() => [
  { label: $t('user_settings.commission_history'), value: 'commission' },
  { label: $t('plus_reading_report.title'), value: 'plus' },
])

const selectedTabItemIndex = ref('commission')
</script>
