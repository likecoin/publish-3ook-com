<template>
  <section class="space-y-4">
    <AppErrorAlert v-model="error" />

    <UAlert
      v-if="!isStripeConnectReady"
      icon="i-heroicons-exclamation-circle"
      color="warning"
      variant="soft"
      :title="$t('user_settings.stripe_express_notice')"
      :description="$t('user_settings.stripe_express_description')"
    />

    <UCard :ui="{ body: 'p-0! sm:p-0! divide-y-1 divide-(--ui-border)' }">
      <AccountSettingsItem
        icon="i-heroicons-banknotes"
        :label="$t('user_settings.stripe_payout_status')"
      >
        <div class="flex flex-col gap-1">
          <div
            class="text-sm text-(--ui-text-muted)"
            v-text="statusLabel"
          />
          <div
            v-if="isStripeConnectReady && currentStripeAccount?.email"
            class="text-xs/5 font-mono text-(--ui-text-muted)"
            v-text="currentStripeAccount.email"
          />
        </div>

        <template #right>
          <div class="flex items-center gap-2">
            <UTooltip :text="$t('user_settings.refresh_status')">
              <UButton
                icon="i-heroicons-arrow-path"
                variant="outline"
                color="neutral"
                :disabled="isLoading"
                :aria-label="$t('user_settings.refresh_status')"
                @click="refreshStripeConnectStatus"
              />
            </UTooltip>

            <UButton
              :label="buttonText"
              :loading="isLoading"
              :disabled="isLoading"
              color="neutral"
              variant="solid"
              @click="handleClickStripeButton"
            />
          </div>
        </template>
      </AccountSettingsItem>
    </UCard>
  </section>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'

const { t: $t } = useI18n()

const apiFetch = useLikeCoApiFetch()
const bookstoreApiStore = useBookstoreApiStore()
const stripeStore = useStripeStore()
const { wallet } = storeToRefs(bookstoreApiStore)
const { getStripeConnectStatusByWallet } = storeToRefs(stripeStore)

const { showErrorToast } = useToastComposable()
const error = ref('')
const isLoading = ref(false)

whenever(isLoading, () => { error.value = '' })

onMounted(refreshStripeConnectStatus)

const currentStripeAccount = computed(() => getStripeConnectStatusByWallet.value(wallet.value))
const isStripeConnectReady = computed(() => currentStripeAccount.value?.isReady)

const statusLabel = computed(() => {
  if (isStripeConnectReady.value) {
    return $t('user_settings.setup_completed')
  }
  if (currentStripeAccount.value?.hasAccount) {
    return $t('user_settings.setup_initiated')
  }
  return $t('user_settings.stripe_not_setup')
})

const buttonText = computed(() => {
  if (isStripeConnectReady.value) {
    return $t('user_settings.login_to_stripe')
  }
  if (currentStripeAccount.value?.hasAccount) {
    return $t('user_settings.resume_stripe_connect_setup')
  }
  return $t('user_settings.setup_stripe_connect')
})

async function refreshStripeConnectStatus() {
  try {
    isLoading.value = true
    await stripeStore.refreshStripeConnectStatus(wallet.value)
  }
  catch (e) {
    error.value = (e as Error).toString()
    showErrorToast(e)
  }
  finally {
    isLoading.value = false
  }
}

async function openStripeConnectURL(path: string) {
  const data = await apiFetch(path, { method: 'POST' })
  const url = (data as { url?: string }).url
  if (!url) {
    throw new Error('CANNOT_GET_STRIPE_CONNECT_URL')
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function handleClickStripeButton() {
  const action = isStripeConnectReady.value ? 'stripe_login' : 'stripe_setup_started'
  useLogEvent(action)
  isLoading.value = true
  try {
    await openStripeConnectURL(
      isStripeConnectReady.value
        ? '/likernft/book/user/connect/login'
        : '/likernft/book/user/connect/new',
    )
  }
  catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    error.value = (e as Error).toString()
    showErrorToast(e)
  }
  finally {
    isLoading.value = false
  }
}
</script>
