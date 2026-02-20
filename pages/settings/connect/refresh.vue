<template>
  <UModal :open="true">
    <template #header>
      <h2 v-if="isLoading" class="text-sm font-bold font-mono">
        Refreshing Stripe Connect Payout Account Status
      </h2>
      <h2 v-else-if="isDone && !error" class="text-sm font-bold font-mono">
        Stripe Connect Account Status Refreshed
      </h2>
      <h2 v-else class="text-sm font-bold font-mono">
        An error occurred when refreshing the Stripe Connect Account Status
      </h2>
    </template>

    <template #body>
      <div v-if="isLoading">
        <UProgress animation="carousel">
          <template #indicator>
            Refreshing...
          </template>
        </UProgress>
      </div>

      <div v-else-if="isDone && !error">
        <UProgress :value="100">
          <template #indicator>
            Refreshed! Redirect back in 3 seconds...
          </template>
        </UProgress>
      </div>

      <div v-else class="space-y-4">
        <UProgress :value="100" color="error" />

        <UAlert
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          :title="error || 'Unknown error'"
        />
      </div>
    </template>

    <template v-if="!isLoading && !isDone" #footer>
      <UButton
        label="Go Back"
        :to="localeRoute({ name: 'settings' })"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'

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

whenever(isLoading, () => { error.value = '' })

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
    isDone.value = (data as { isReady?: boolean }).isReady || false

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
