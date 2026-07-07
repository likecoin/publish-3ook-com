<template>
  <UForm
    ref="formRef"
    :state="formState"
    :validate="onFormValidate"
    :validate-on="['change', 'blur']"
    class="flex flex-col gap-[24px]"
    @submit.prevent
  >
    <ul class="flex flex-col gap-[12px]">
      <UCard
        :ui="{
          root: 'overflow-visible border-none border-transparent!',
          body: 'space-y-5 relative',
        }"
      >
        <li
          v-for="(p, index) in prices"
          :key="p.index"
        >
          <UCard
            :ui="{
              root: 'overflow-visible border-4',
              body: 'flex flex-col gap-[20px]',
            }"
          >
            <template #header>
              <h3
                class="font-bold font-mono"
                v-text="`${$t('nft_book_form.edition_number', { number: (displayEditIndex || (index + 1)) })} - ${p.name || $t('nft_book_form.product_name_placeholder')}`"
              />
            </template>

            <!-- 1. What this edition is -->
            <UFormField
              :name="`prices.${index}.name`"
              :ui="{ container: 'space-y-2' }"
            >
              <template #label>
                {{ $t('nft_book_form.product_name') }}
                <ToolTips :image-style="{ width: '250px' }">
                  <template #image>
                    <img
                      src="~/assets/images/hint/editionInfo-en.png"
                      class="object-cover"
                      alt=""
                    >
                  </template>
                  <UIcon name="i-heroicons-question-mark-circle" />
                </ToolTips>
              </template>
              <UInput
                v-model="p.name"
                :placeholder="$t('nft_book_form.product_name_placeholder')"
              />
            </UFormField>

            <!-- Editing a saved edition keeps the description under the name. -->
            <PublishEditionDescriptionField
              v-if="mode === 'edit'"
              v-model="p.description"
              :editor-id="`pricing-${index}`"
            />

            <!-- 2. Price -->
            <UFormField
              :name="`prices.${index}.price`"
              :label="$t('nft_book_form.unit_price_label')"
            >
              <div class="space-y-3">
                <UCheckbox
                  v-if="shouldShowCustomPricingUI(p)"
                  v-model="p.isCustomPricing"
                  :label="$t('nft_book_form.use_custom_pricing')"
                  @update:model-value="(v: boolean | 'indeterminate') => onCustomPricingToggle(p, v === true)"
                />
                <USelect
                  v-if="!p.isCustomPricing"
                  v-model="p.price"
                  class="w-full"
                  :items="USD_PRICING_OPTIONS"
                  value-key="value"
                />
                <div
                  v-else
                  class="flex flex-col gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <p class="text-xs text-gray-600">
                    {{ $t('nft_book_form.custom_pricing_description') }}
                  </p>
                  <UFormField :label="$t('nft_book_form.custom_price_usd')">
                    <UInput
                      v-model="p.priceUSDInput"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                    />
                  </UFormField>
                  <UFormField :label="$t('nft_book_form.custom_price_hkd')">
                    <UInput
                      v-model="p.priceHKDInput"
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                    />
                  </UFormField>
                  <UFormField :label="$t('nft_book_form.custom_price_twd')">
                    <UInput
                      v-model="p.priceTWDInput"
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                    />
                  </UFormField>
                </div>
              </div>
            </UFormField>

            <!-- New listings: description is optional and collapsed so the
                 rarely-used editor no longer pushes the price down the card. -->
            <PublishEditionDescriptionField
              v-if="mode === 'new'"
              v-model="p.description"
              :editor-id="`pricing-${index}`"
              collapsible
            />

            <!-- 3. Copies / delivery -->
            <UFormField
              :label="$t('nft_book_form.copies_label')"
            >
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <URadioGroup
                    v-model="p.deliveryMethod"
                    :items="[
                      { label: $t('nft_book_form.unlimited'), value: 'auto' },
                      { label: $t('nft_book_form.limited'), value: 'manual' },
                    ]"
                    orientation="vertical"
                  />
                  <UTooltip
                    v-if="p.deliveryMethod === 'manual'"
                    :text="$t('nft_book_form.manual_delivery_tooltip')"
                  >
                    <UIcon name="i-heroicons-question-mark-circle" />
                  </UTooltip>
                </div>

                <div
                  v-if="p.deliveryMethod === 'manual'"
                  class="space-y-3"
                >
                  <UFormField :label="$t('nft_book_form.stock')">
                    <UInput
                      v-model="p.stock"
                      type="number"
                      step="1"
                      :min="1"
                      :max="maxSupply"
                      placeholder="100"
                    />
                  </UFormField>
                </div>
              </div>
            </UFormField>

            <!-- 4. Delivery extras -->
            <UFormField :label="$t('nft_book_form.enable_custom_message_page')">
              <div class="space-y-3 w-full">
                <UFormField
                  :label="$t('nft_book_form.auto_delivery_memo')"
                >
                  <UInput
                    v-model="p.autoMemo"
                    :placeholder="$t('nft_book_form.memo_placeholder')"
                    :disabled="p.deliveryMethod === 'manual'"
                  />
                </UFormField>

                <UFormField :ui="{ label: 'w-full flex justify-between items-center' }">
                  <template #label>
                    <p
                      class="block"
                      v-text="$t('nft_book_form.autograph_image')"
                    />
                    <span
                      class="text-gray-500 text-[12px] block"
                      v-text="$t('nft_book_form.image_requirements')"
                    />
                  </template>
                  <UInput
                    type="file"
                    accept="image/png"
                    @input="onImgUpload"
                  />
                  <div
                    v-if="signatureImagePreview"
                    class="mt-2"
                  >
                    <img
                      :src="signatureImagePreview"
                      alt="Signature preview"
                      class="w-full max-h-[180px] object-contain rounded border border-gray-200"
                    >
                  </div>
                  <p
                    v-else-if="hasExistingSignatureImage"
                    class="mt-2 text-sm text-gray-500"
                    v-text="$t('nft_book_form.autograph_image_uploaded')"
                  />
                </UFormField>
              </div>
            </UFormField>

            <!-- 5. Store visibility -->
            <UFormField>
              <div class="flex items-center gap-2">
                <USwitch v-model="p.isListed" />
                <span
                  class="text-sm"
                  v-text="$t('nft_book_form.list_for_sale')"
                />
              </div>
              <p
                v-if="!p.isListed"
                class="text-muted text-[12px] mt-1"
                v-text="$t('nft_book_form.list_for_sale_off_hint')"
              />
            </UFormField>
          </UCard>

          <div class="flex justify-center items-center mt-2">
            <UButton
              v-if="hasMultiplePrices"
              :label="$t('common.delete')"
              color="neutral"
              leading-icon="i-heroicons-trash"
              @click="deletePrice(index)"
            />
          </div>
        </li>
      </UCard>
    </ul>
    <div class="flex justify-center items-center">
      <UButton
        v-if="mode === 'new' && prices.length < maxEditions"
        class="rounded-full"
        color="neutral"
        icon="i-heroicons-plus-solid"
        :label="$t('nft_book_form.add_edition')"
        @click="addMorePrice"
      />
    </div>

    <!-- Advanced settings -->
    <UCard
      :ui="{
        header: 'flex justify-between items-center',
        body: 'p-3 space-y-4',
      }"
    >
      <div class="flex justify-between items-center w-full">
        <h3
          class="font-bold font-mono"
          v-text="$t('nft_book_form.sale_settings')"
        />
        <UButton
          color="neutral"
          variant="ghost"
          :icon="
            shouldShowAdvanceSettings
              ? 'i-heroicons-chevron-up'
              : 'i-heroicons-chevron-down'
          "
          @click="shouldShowAdvanceSettings = !shouldShowAdvanceSettings"
        />
      </div>
      <template v-if="shouldShowAdvanceSettings">
        <div class="mt-[24px] flex flex-col gap-[12px]">
          <!-- Content settings -->
          <BookSettingsFields
            v-if="mode === 'new'"
            v-model:is-adult-only="settings.isAdultOnly"
            v-model:hide-audio="settings.hideAudio"
            v-model:is-plus-reading-enabled="settings.isPlusReadingEnabled"
            :is-free-book="isFreeBook"
          />

          <!-- Sales settings -->
          <UFormField class="flex items-center">
            <UTooltip
              class="flex items-center gap-2"
              :text="$t('nft_book_form.accept_tipping_tooltip')"
            >
              <UCheckbox
                v-model="settings.isAllowCustomPrice"
                name="isAllowCustomPrice"
                :label="$t('nft_book_form.accept_tipping')"
              />

              <UIcon name="i-heroicons-question-mark-circle" />
            </UTooltip>
          </UFormField>

          <!-- Stripe connect list -->
          <UFormField
            v-if="mode === 'new'"
            :label="$t('nft_book_form.stripe_connect_wallets')"
          >
            <div
              v-for="(stripeWallet) in stripeConnectWallets"
              :key="stripeWallet"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-heroicons-wallet"
                  class="text-gray-500"
                />
                <span
                  class="font-mono text-sm"
                  v-text="stripeWallet"
                />
                <UBadge
                  v-if="stripeWallet === sessionWallet"
                  variant="soft"
                  color="success"
                  size="xs"
                >
                  {{ $t('nft_book_form.current_wallet') }}
                </UBadge>
              </div>
            </div>
            <div
              v-if="stripeConnectWallets.length === 0 && sessionWalletStripeStatus?.isReady"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
            >
              {{ $t('nft_book_form.no_wallets') }}
              <UButton
                variant="outline"
                color="primary"
                size="xs"
                :label="$t('nft_book_form.link_wallet')"
                @click="settings.connectedWallets = { [sessionWallet]: 100 }"
              />
            </div>
            <div
              v-else-if="stripeConnectWallets.length === 0"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
            >
              {{ $t('nft_book_form.no_wallets') }}
              <UButton
                variant="outline"
                color="error"
                size="xs"
                :label="$t('nft_book_form.connect_wallet')"
                @click="navigateTo('/settings')"
              />
            </div>
          </UFormField>
        </div>
      </template>
    </UCard>
  </UForm>
</template>

<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'

import type { FormError } from '#ui/types'
import {
  USD_PRICING_OPTIONS,
  DEFAULT_MAX_SUPPLY,
  MAX_EDITION_COUNT,
} from '~/constant'
import type { PriceFormItem, PricingFormSettings } from '~/types/publish'
import { getPriceItemUSDValue, validatePriceFormItems, createDefaultPriceFormItem } from '~/utils/listing'

const { t: $t } = useI18n()
const { showErrorToast } = useToastComposable()
const { validateWithFeedback } = useFormValidateFeedback()
const stripeStore = useStripeStore()
const { fetchStripeConnectStatusByWallet } = stripeStore
const { getStripeConnectStatusByWallet } = storeToRefs(stripeStore)
const bookstoreApiStore = useBookstoreApiStore()
const { wallet: sessionWallet } = storeToRefs(bookstoreApiStore)

const UPLOAD_FILESIZE_MAX = 1 * 1024 * 1024

const { mode = 'new', maxEditions = MAX_EDITION_COUNT, displayEditIndex = undefined, hasExistingSignatureImage = false } = defineProps<{
  mode?: 'new' | 'edit'
  maxEditions?: number
  displayEditIndex?: number
  hasExistingSignatureImage?: boolean
}>()

const prices = defineModel<PriceFormItem[]>('prices', { required: true })
const settings = defineModel<PricingFormSettings>('settings', { required: true })
const signatureImage = defineModel<File | null>('signatureImage', { default: null })

const signatureImagePreview = useObjectUrl(signatureImage)
const shouldShowAdvanceSettings = ref(true)
const maxSupply = ref(Number(DEFAULT_MAX_SUPPLY))
const route = useRoute()

// Backdoor: ?advanced_pricing=1 reveals the custom USD/HKD/TWD pricing UI.
const isAdvancedPricingEnabled = computed(() => route.query.advanced_pricing === '1')
function shouldShowCustomPricingUI(p: PriceFormItem): boolean {
  return isAdvancedPricingEnabled.value || p.isCustomPricing
}
function onCustomPricingToggle(p: PriceFormItem, enabled: boolean) {
  if (enabled && p.priceUSDInput === '' && p.price && p.price !== '-1') {
    p.priceUSDInput = p.price
  }
}
const hasMultiplePrices = computed(() => prices.value.length > 1)
// A free price tier (0) always opts the book into Plus all-you-can-read.
const isFreeBook = computed(() => prices.value.some(p => getPriceItemUSDValue(p) === 0))

// UForm routes each returned error to the UFormField whose name matches
// (prices.{i}.{field}); no per-field :error piping needed.
const formRef = ref()
const formState = computed(() => ({ prices: prices.value }))

function onFormValidate(): FormError[] {
  return validatePriceFormItems(prices.value, $t)
}

// Hosts call this on submit: shows inline errors on invalid fields, toasts
// the messages, and scrolls the first offender into view.
async function validate(): Promise<boolean> {
  return validateWithFeedback(formRef.value)
}

defineExpose({ validate })

const stripeConnectWallets = computed(() => Object.keys(settings.value.connectedWallets || {}))
const sessionWalletStripeStatus = computed(() => {
  if (!sessionWallet.value) { return null }
  return getStripeConnectStatusByWallet.value(sessionWallet.value)
})

watch(() => settings.value.isAllowCustomPrice, (newValue: boolean) => {
  prices.value.forEach((price: PriceFormItem) => {
    price.isAllowCustomPrice = newValue
  })
})

onMounted(async () => {
  if (mode !== 'new') { return }
  if (!stripeConnectWallets.value.length && sessionWallet.value) {
    try {
      const { isReady } = await fetchStripeConnectStatusByWallet(sessionWallet.value)
      if (isReady) {
        settings.value.connectedWallets = { [sessionWallet.value]: 100 }
      }
    }
    catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }
})

function addMorePrice() {
  prices.value.push(createDefaultPriceFormItem({ index: uuidv4(), name: '增訂版' }))
}

function deletePrice(index: number) {
  prices.value.splice(index, 1)
}

function onImgUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files

  if (!files?.length) { return }

  const file = files[0]
  if (!file) { return }
  signatureImage.value = null
  if (file.type !== 'image/png') {
    showErrorToast($t('errors.png_only'))
    input.value = ''
    return
  }
  if (file.size > UPLOAD_FILESIZE_MAX) {
    showErrorToast($t('errors.file_size_limit'))
    input.value = ''
    return
  }

  signatureImage.value = file
}
</script>
