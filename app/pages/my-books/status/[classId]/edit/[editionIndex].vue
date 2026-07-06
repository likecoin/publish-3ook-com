<template>
  <div>
    <UModal
      :open="true"
      class="sm:max-w-7xl"
    >
      <template #header>
        <h2 class="font-bold font-mono">
          {{ pageTitle }}
        </h2>

        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-x-mark-20-solid"
          class="-my-1"
          @click="handleClickBack"
        />
      </template>

      <template #body>
        <BookStatusEditionEditForm
          :edition-index="editionIndex"
          :class-id="classId"
          @submit="handleSubmit"
        />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()
const route = useRoute()
const localeRoute = useLocaleRoute()

const classId = ref(route.params.classId?.toString() || '')
const editionIndex = ref(route.params.editionIndex as string)

const classData = ref<{ prices?: unknown[] }>({})
const hasMultiplePrices = computed(() => (classData.value?.prices?.length ?? 0) > 1)

const priceItemLabel = computed(() => hasMultiplePrices.value ? 'edition' : 'book')

const pageTitle = computed(() =>
  hasMultiplePrices.value
    ? $t('pages.edit_edition_info', { type: priceItemLabel.value, number: `#${editionIndex.value}` })
    : $t('pages.edit_book_price_info'),
)

async function handleClickBack() {
  await navigateTo(localeRoute({
    name: 'my-books-status-classId',
    params: { classId: classId.value },
  }))
}

async function handleSubmit() {
  await navigateTo(localeRoute({
    name: 'my-books-status-classId',
    params: { classId: classId.value },
  }))
}
</script>
