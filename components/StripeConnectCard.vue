<template>
  <UCard
    :ui="{
      header: 'flex flex-wrap justify-between items-center gap-2',
      body: isStripeConnectChecked ? undefined : 'p-0',
    }"
  >
    <template #header>
      <h3 class="font-bold font-mono">
        {{ $t('stripe_connect.connect_title') }}
      </h3>
      <USwitch
        v-model="isStripeConnectChecked"
        name="stripe"
        :label="$t('stripe_connect.connect_description')"
      />
    </template>

    <template v-if="isStripeConnectChecked">
      <div class="flex flex-col gap-[24px]">
        <URadioGroup
          v-model="accountType"
          :items="[
            { label: $t('stripe_connect.use_my_account'), value: 'default' },
            { label: $t('stripe_connect.use_another_account'), value: 'other' },
          ]"
          :disabled="!!props.shouldDisableSetting"
          orientation="vertical"
        />
        <div class="grid grid-cols-2 gap-[8px] w-full">
          <div class="flex flex-col w-full">
            <div
              v-if="defaultAccountConnectStatus.isReady"
              class="flex flex-col items-start w-full"
            >
              <div
                class="flex flex-col gap-[8px] mt-[12px] px-[6px] py-[4px] w-[80%]"
              >
                <UAlert
                  icon="i-heroicons-check"
                  color="primary"
                  variant="outline"
                  :title="$t('stripe_connect.has_stripe_account')"
                />
                <div
                  v-if="defaultAccountConnectStatus.email"
                  v-text="`Email: ${defaultAccountConnectStatus.email}`"
                />
              </div>
            </div>
            <span v-else>
              <UButton
                class="mt-2"
                :label="$t('stripe_connect.create_one_here')"
                :to="localeRoute({ name: 'settings' })"
                target="_blank"
                variant="outline"
              />
            </span>
          </div>

          <div class="flex flex-col w-full">
            <div class="flex flex-col mt-[14px] w-[80%]">
              <UInput
                v-model="inputWallet"
                :color="stripeConnectInputError ? 'error' : 'neutral'"
                class="font-mono w-full"
                placeholder="0x..."
                @input="onStripeConnectWalletInput"
              />
              <span
                v-if="stripeConnectInputError"
                class="text-red-700 text-[10px]"
              >{{ stripeConnectInputError }}</span>
            </div>
            <UProgress v-if="isStripeConnectLoading" class="my-[6px]" animation="carousel" />
            <div
              v-else-if="inputWallet && inputAccountConnectStatus"
              class="flex flex-col gap-[8px] mt-[12px] px-[6px] py-[4px] w-[80%]"
            >
              <div v-if="inputAccountConnectStatus.isReady">
                <UAlert
                  icon="i-heroicons-check"
                  color="primary"
                  variant="outline"
                  :title="$t('stripe_connect.has_stripe_account')"
                />
                <div
                  v-if="inputAccountConnectStatus.email"
                  v-text="$t('stripe_connect.email_prefix') + inputAccountConnectStatus.email"
                />
              </div>
              <UAlert
                v-else
                icon="i-heroicons-x-mark"
                color="error"
                variant="outline"
                :title="$t('stripe_connect.no_account_connected')"
              />
            </div>
          </div>
        </div>
        <div class="flex flex-col items-center justify-center gap-[8px] w-full">
          <UButton
            :label="$t('stripe_connect.save_changes')"
            :loading="isUpdatingStripeAccount"
            :color="isStripeConnectWalletReadyToSave ? 'primary' : 'neutral'"
            :disabled="
              !isStripeConnectWalletReadyToSave || !!props.shouldDisableSetting
            "
            @click="handleSaveStripeConnectWallet"
          />
          <div
            v-if="!!props.shouldDisableSetting"
            class="text-center text-green-800 text-[12px]"
          >
            {{ $t('stripe_connect.save_success') }}
          </div>
        </div>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import { LIKE_ADDRESS_REGEX } from '~/constant'
const localeRoute = useLocaleRoute()
const { t: $t } = useI18n()

const stripeStore = useStripeStore()

const { fetchStripeConnectStatusByWallet } = stripeStore
const { getStripeConnectStatusByWallet } = storeToRefs(stripeStore)

const isStripeConnectChecked = defineModel<boolean>('isStripeConnectChecked')
const isUsingDefaultAccount = defineModel<boolean>('isUsingDefaultAccount')

const props = defineProps({
  loginAddress: {
    type: String,
    default: ''
  },
  shouldDisableSetting: {
    type: Boolean,
    default: false
  },
  stripeConnectWallet: {
    type: String,
    default: ''
  },
  isUpdatingStripeAccount: {
    type: Boolean,
    default: false
  }
})

// eslint-disable-next-line func-call-spacing
const emit = defineEmits<{
  (e: 'save', wallet: string | undefined): void;
}>()

const accountType = computed({
  get: () => isUsingDefaultAccount.value ? 'default' : 'other',
  set: (val: string) => { isUsingDefaultAccount.value = val === 'default' }
})

const inputWallet = ref('')
const stripeConnectInputError = ref('')
const isStripeConnectLoading = ref(false)
const defaultAccountConnectStatus = computed(() => getStripeConnectStatusByWallet.value(props.loginAddress))
const inputAccountConnectStatus = computed(() => getStripeConnectStatusByWallet.value(inputWallet.value))

const isStripeConnectWalletReadyToSave = computed(() => {
  if (!isStripeConnectChecked.value) { return false }
  if (isUsingDefaultAccount.value && !defaultAccountConnectStatus.value.isReady) { return false }
  if ((!isUsingDefaultAccount.value && !inputAccountConnectStatus.value.isReady) || stripeConnectInputError.value) { return false }
  return true
})

watch(() => props.stripeConnectWallet, (wallet) => {
  if (wallet && !isUsingDefaultAccount.value) {
    inputWallet.value = wallet
  }
}, { immediate: true })

async function onStripeConnectWalletInput (input: any) {
  if (!isStripeConnectChecked.value) { return }
  const inputValue = input.target.value.trim()
  inputWallet.value = inputValue
  stripeConnectInputError.value = ''

  if (!(LIKE_ADDRESS_REGEX.test(inputValue) || inputValue.startsWith('0x'))) {
    stripeConnectInputError.value = $t('stripe_connect.invalid_wallet')
    return
  }

  const status = getStripeConnectStatusByWallet.value(inputValue)
  if (status.isReady) {
    return status
  }

  isStripeConnectLoading.value = true
  try {
    await fetchStripeConnectStatusByWallet(inputValue)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  } finally {
    isStripeConnectLoading.value = false
  }
}

function handleSaveStripeConnectWallet () {
  const wallet = isUsingDefaultAccount.value ? props.loginAddress : inputWallet.value
  emit('save', wallet)
}

</script>
