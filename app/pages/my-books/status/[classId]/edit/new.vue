<template>
  <UModal
    :open="true"
    class="sm:max-w-7xl p-4 sm:p-8"
  >
    <template #header>
      <div class="flex justify-end">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-x-mark-20-solid"
          @click="handleClickBack"
        />
      </div>
    </template>

    <template #body>
      <BookStatusEditionEditForm
        is-new-edition
        :class-id="classId"
        :edition-index="newEditionIndex"
        @submit="handleNewBookSubmit"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
const route = useRoute()
const localeRoute = useLocaleRoute()
const { showErrorToast } = useToastComposable()

const classId = ref(route.params.classId?.toString() || '')
const newEditionIndex = computed(() => {
  return route.query.price_index?.toString() || ''
})

const isLoading = ref(false)

async function handleNewBookSubmit() {
  try {
    await navigateTo(localeRoute({
      name: 'my-books-status-classId',
      params: { classId: classId.value },
    }))
  }
  catch (err) {
    const errorData = (err as { data?: string }).data || err
    // eslint-disable-next-line no-console
    console.error(errorData)
    showErrorToast(String(errorData), { duration: 0 })
  }
  finally {
    isLoading.value = false
  }
}

async function handleClickBack() {
  await navigateTo(localeRoute({
    name: 'my-books-status-classId',
    params: { classId: classId.value },
  }))
}
</script>
