<template>
  <UModal :model-value="true">
    <!-- Loading -->
    <UCard v-if="isLoading">
      <template #header>
        <h2 class="text-sm font-bold font-mono">
          Refreshing Stripe Connect Payout Account Status
        </h2>
      </template>

      <UProgress animation="carousel">
        <template #indicator>
          Refreshing...
        </template>
      </UProgress>
    </UCard>

    <!-- Success case -->
    <UCard v-else-if="isDone && !error">
      <template #header>
        <h2 class="text-sm font-bold font-mono">
          Stripe Connect Account Status Refreshed
        </h2>
      </template>

      <UProgress :value="100">
        <template #indicator>
          Refreshed! Redirect back in 3 seconds...
        </template>
      </UProgress>
    </UCard>

    <!-- Error case -->
    <UCard
      v-else
      :ui="{
        body: { base: 'space-y-4' },
        footer: { base: 'text-center' }
      }"
    >
      <template #header>
        <h2 class="text-sm font-bold font-mono">
          An error occurred when refreshing the Stripe Connect Account Status
        </h2>
      </template>

      <UProgress :value="100" color="red" />

      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="red"
        variant="soft"
        :title="error || 'Unknown error'"
      />

      <template #footer>
        <UButton
          label="Go Back"
          :to="localeRoute({ name: 'settings' })"
        />
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
const { LIKE_CO_API } = useRuntimeConfig().public

const localeRoute = useLocaleRoute()
const bookstoreApiStore = useBookstoreApiStore()
const { token } = storeToRefs(bookstoreApiStore)

const error = ref('')
const isLoading = ref(false)
const isDone = ref(false)

definePageMeta({
  layout: 'page'
})

watch(isLoading, (newIsLoading) => {
  if (newIsLoading) { error.value = '' }
})

onMounted(async () => {
  try {
    isLoading.value = true
    const data = await $fetch(`${LIKE_CO_API}/likernft/book/user/connect/refresh`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token.value}`
        }
      }
    )
    isDone.value = (data as any).isReady || false

    setTimeout(async () => {
      await navigateTo(localeRoute({ name: 'settings' }), { replace: true })
    }, 3000)
  } catch (e) {
    console.error(e)
    error.value = (e as Error).toString()
  } finally {
    isLoading.value = false
  }
})
</script>
