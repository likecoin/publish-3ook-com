<template>
  <PageBody>
    <UAlert
      v-if="error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="`${error}`"
      :close="{ icon: 'i-heroicons-x-mark-20-solid', color: 'error', variant: 'link' }"
      @close="error = ''"
    />

    <UAlert
      v-if="!isStripeConnectReady"
      icon="i-heroicons-exclamation-circle"
      color="warning"
      variant="soft"
      :title="$t('user_settings.stripe_express_notice')"
      :description="$t('user_settings.stripe_express_description')"
    />

    <template v-if="bookstoreApiStore.isAuthenticated">
      <UCard
        :ui="{
          header: 'flex justify-between items-center',
          body: 'p-0',
          footer: 'text-center',
        }"
      >
        <template #header>
          <h1 class="text-center font-bold font-mono">
            {{ $t('user_settings.stripe_payout_status') }}
          </h1>

          <UTooltip
            text="Refresh Status"
            :popper="{ placement: 'left' }"
          >
            <UButton
              icon="i-heroicons-arrow-path"
              variant="outline"
              :disabled="isLoading"
              @click="refreshStripeConnectStatus"
            />
          </UTooltip>
        </template>

        <template #footer>
          <div class="flex flex-col justify-center items-center gap-4">
            <span
              v-if="currentStripeAccount?.hasAccount && isStripeConnectReady"
              class="text-sm text-gray-500"
              v-text="currentStripeAccount.email"
            />
            <UButton
              :label="buttonText"
              size="md"
              :loading="isLoading"
              :disabled="isLoading"
              color="neutral"
              variant="solid"
              @click="handleClickStripeButton"
            />
          </div>
        </template>
      </UCard>
    </template>
  </PageBody>
</template>

<script setup lang="ts">
const { LIKE_CO_API } = useRuntimeConfig().public
const { t: $t } = useI18n()

const bookstoreApiStore = useBookstoreApiStore()
const stripeStore = useStripeStore()
const { token, wallet } = storeToRefs(bookstoreApiStore)
const { getStripeConnectStatusByWallet } = storeToRefs(stripeStore)

const { showErrorToast } = useToastComposable()
const error = ref('')
const isLoading = ref(false)

watch(isLoading, (newIsLoading) => {
  if (newIsLoading) { error.value = '' }
})

onMounted(async () => {
  await stripeStore.refreshStripeConnectStatus(wallet.value)
})

const currentStripeAccount = computed(() => getStripeConnectStatusByWallet.value(wallet.value))
const isStripeConnectReady = computed(() => currentStripeAccount.value?.isReady)

const buttonText = computed(() => {
  if (!currentStripeAccount.value?.hasAccount && !isStripeConnectReady.value) {
    return $t('user_settings.setup_stripe_connect')
  } else if (currentStripeAccount.value?.hasAccount && !isStripeConnectReady.value) {
    return $t('user_settings.resume_stripe_connect_setup')
  } else if (currentStripeAccount.value?.hasAccount && isStripeConnectReady.value) {
    return $t('user_settings.login_to_stripe')
  }
})

async function refreshStripeConnectStatus () {
  try {
    isLoading.value = true
    await stripeStore.refreshStripeConnectStatus(wallet.value)
  } catch (e) {
    error.value = (e as Error).toString()
    showErrorToast(e)
  } finally {
    isLoading.value = false
  }
}

async function onLoginToStripe () {
  try {
    isLoading.value = true
    const data = await $fetch(`${LIKE_CO_API}/likernft/book/user/connect/login`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token.value}`
        }
      }
    )
    const url = (data as { url?: string }).url
    if (url) {
      window.open(url)
    } else {
      throw new Error('CANNOT_GET_STRIPE_CONNECT_RUL')
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    error.value = (e as Error).toString()
    showErrorToast(e)
  } finally {
    isLoading.value = false
  }
}

async function onSetupStripe () {
  try {
    isLoading.value = true
    const data = await $fetch(`${LIKE_CO_API}/likernft/book/user/connect/new`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token.value}`
        }
      }
    )
    const url = (data as { url?: string }).url
    if (url) {
      window.open(url)
    } else {
      throw new Error('CANNOT_GET_STRIPE_CONNECT_RUL')
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    error.value = (e as Error).toString()
    showErrorToast(e)
  } finally {
    isLoading.value = false
  }
}

async function handleClickStripeButton () {
  isLoading.value = true
  try {
    if (!isStripeConnectReady.value) {
      await onSetupStripe()
    } else {
      await onLoginToStripe()
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    error.value = (e as Error).toString()
    showErrorToast(e)
  } finally {
    isLoading.value = false
  }
}

</script>
