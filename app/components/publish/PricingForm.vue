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
            <template
              v-if="!isSingleEditionLayout"
              #header
            >
              <h3
                class="font-bold font-mono"
                v-text="`${$t('nft_book_form.edition_number', { number: (displayEditIndex || (index + 1)) })} - ${p.name || $t('nft_book_form.product_name_placeholder')}`"
              />
            </template>

            <!-- A book with one edition is a book with a price, so the price
                 leads and the numbers it implies sit beside it. With more than
                 one, the name leads, since that is what tells them apart —
                 hence the ordering rather than two copies of the pair. -->
            <div :class="isSingleEditionLayout ? 'grid gap-4 md:grid-cols-2 items-start' : 'contents'">
              <!-- flex, not space-y: `order` is what puts the price first, and
                   it only applies to flex or grid children. -->
              <div :class="isSingleEditionLayout ? 'flex flex-col gap-4' : 'contents'">
                <PublishEditionNameField
                  v-model:price="prices[index]!"
                  :index="index"
                  :placeholder="namePlaceholder"
                  :class="isSingleEditionLayout ? 'order-2' : ''"
                />
                <PublishEditionPriceField
                  v-model:price="prices[index]!"
                  :index="index"
                  :show-ladder-hint="isSingleEditionLayout"
                  :class="isSingleEditionLayout ? 'order-1' : ''"
                />
              </div>
              <PublishEditionRevenueInline
                v-if="isSingleEditionLayout"
                :price="p"
              />
            </div>

            <!-- Collapsed by default so the rarely-used editor does not push
                 the price down the card. -->
            <PublishEditionDescriptionField
              v-model="p.description"
              :editor-id="`pricing-${index}`"
            />

            <PublishEditionAdvancedPanel :collapsible="isSingleEditionLayout">
              <!-- Tipping is stored per edition. The other modes set it for
                   every edition at once from the sale-settings card below, which
                   does not exist in manage mode, so edit it in place there. -->
              <UFormField
                v-if="mode === 'manage'"
                class="flex items-center"
              >
                <UTooltip
                  class="flex items-center gap-2"
                  :text="$t('nft_book_form.accept_tipping_tooltip')"
                >
                  <UCheckbox
                    v-model="p.isAllowCustomPrice"
                    :name="`prices.${index}.isAllowCustomPrice`"
                    :label="$t('nft_book_form.accept_tipping')"
                  />

                  <UIcon name="i-heroicons-question-mark-circle" />
                </UTooltip>
              </UFormField>

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
                        v-model.number="p.stock"
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
                        class="text-muted text-[12px] block"
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
                        class="w-full max-h-[180px] object-contain rounded border border-default"
                      >
                    </div>
                    <p
                      v-else-if="hasExistingSignatureImage"
                      class="mt-2 text-sm text-muted"
                      v-text="$t('nft_book_form.autograph_image_uploaded')"
                    />
                  </UFormField>
                </div>
              </UFormField>

              <!-- Both options are named and both say what they do: hiding an
                   edition does not stop it selling through a purchase link,
                   which a bare off-switch never conveyed. -->
              <UFormField :label="$t('nft_book_form.edition_visibility')">
                <URadioGroup
                  :model-value="p.isListed ? 'sell' : 'hide'"
                  :items="[
                    {
                      label: $t('nft_book_form.edition_visibility_sell'),
                      description: $t('nft_book_form.edition_visibility_sell_hint'),
                      value: 'sell',
                    },
                    {
                      label: $t('nft_book_form.edition_visibility_hide'),
                      description: $t('nft_book_form.edition_visibility_hide_hint'),
                      value: 'hide',
                    },
                  ]"
                  orientation="vertical"
                  :ui="{ fieldset: 'gap-3' }"
                  @update:model-value="(value) => (p.isListed = value === 'sell')"
                />
              </UFormField>
            </PublishEditionAdvancedPanel>
          </UCard>
        </li>
      </UCard>
    </ul>

    <!-- Advanced settings. Hidden in manage mode: the class-level settings
         live in their own card there, and this tipping checkbox would silently
         rewrite every edition's stored value — each edition card carries its
         own instead. -->
    <UCard
      v-if="mode !== 'manage'"
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
            v-model:is-preview-enabled="settings.isPreviewEnabled"
            v-model:preview-percentage="settings.previewPercentage"
            :is-free-book="isFreeBook"
          />

          <!-- Live free-preview cut readout: the straddled chapter is included
               in full where that stays under the ceiling, so the actual range
               can exceed the nominal %; past it the chapter ships part-way. -->
          <div
            v-if="mode === 'new' && previewCut"
            class="p-3 border border-default rounded-lg bg-elevated text-sm"
          >
            <template v-if="previewCut.ok">
              <p
                class="font-medium"
                v-text="$t('nft_book_form.preview_actual_range')"
              />
              <ul class="mt-1 list-disc list-inside text-muted">
                <li
                  v-for="item in previewCut.includedItems"
                  :key="item.href"
                  v-text="item.isPartial
                    ? $t('nft_book_form.preview_partial_item', { label: item.label })
                    : item.label"
                />
              </ul>
              <p
                class="mt-1 text-muted"
                v-text="$t('nft_book_form.preview_actual_percent', { percent: previewCut.effectivePercentageRounded })"
              />
            </template>

            <!-- The server refuses these files: a reader would get a 403. -->
            <p
              v-else
              class="text-error"
              v-text="previewCut.message"
            />
          </div>

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
              class="flex items-center justify-between p-3 bg-elevated rounded-lg"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-heroicons-wallet"
                  class="text-muted"
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
              class="flex items-center justify-between p-3 bg-elevated rounded-lg text-sm"
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
              class="flex items-center justify-between p-3 bg-elevated rounded-lg text-sm"
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

import type { FormError } from '#ui/types'
import { DEFAULT_MAX_SUPPLY } from '~/constant'
import type { PriceFormItem, PricingFormSettings } from '~/types/publish'
import type { EpubSpineItem } from '~/types'
import { getPriceItemUSDValue, validatePriceFormItems } from '~/utils/listing'

const { t: $t } = useI18n()
const { showErrorToast } = useToastComposable()
const { validateWithFeedback } = useFormValidateFeedback()
const stripeStore = useStripeStore()
const { fetchStripeConnectStatusByWallet } = stripeStore
const { getStripeConnectStatusByWallet } = storeToRefs(stripeStore)
const bookstoreApiStore = useBookstoreApiStore()
const { wallet: sessionWallet } = storeToRefs(bookstoreApiStore)

const UPLOAD_FILESIZE_MAX = 1 * 1024 * 1024

// 'new' collects a full draft in the wizard; 'edit' hosts one edition in the
// add-edition modal; 'manage' hosts every live edition of a published book,
// where structure (add/delete) and class settings are owned elsewhere.
const {
  mode = 'new',
  displayEditIndex = undefined,
  hasExistingSignatureImage = false,
  epubSpineItems = undefined,
  namePlaceholder = '',
  reservedNames = undefined,
} = defineProps<{
  mode?: 'new' | 'edit' | 'manage'
  displayEditIndex?: number
  hasExistingSignatureImage?: boolean
  // Spine table of the uploaded EPUB, for the free-preview cut readout.
  epubSpineItems?: EpubSpineItem[]
  namePlaceholder?: string
  // Names already taken by editions this form does not show, so a new one
  // cannot collide with them.
  reservedNames?: string[]
}>()

const prices = defineModel<PriceFormItem[]>('prices', { required: true })
const settings = defineModel<PricingFormSettings>('settings', { required: true })
const signatureImage = defineModel<File | null>('signatureImage', { default: null })

const signatureImagePreview = useObjectUrl(signatureImage)
const shouldShowAdvanceSettings = ref(true)
const maxSupply = ref(Number(DEFAULT_MAX_SUPPLY))

// A published book with one edition has no edition to choose between, so the
// price leads and the per-edition machinery collapses. Two or more keep the
// full cards, where telling them apart is the whole point.
const isSingleEditionLayout = computed(() => mode === 'manage' && prices.value.length === 1)
// A free price tier (0) always opts the book into Plus all-you-can-read.
const isFreeBook = computed(() => prices.value.some(p => getPriceItemUSDValue(p) === 0))

// Actual preview outcome of the "generous" chapter cut, recomputed live as the
// percentage input changes. null hides the readout (disabled or no EPUB).
// Every remaining refusal is about the file being unusable rather than about
// how it is chaptered, so there is nothing chapter-specific left to advise.
const previewCut = computed(() => {
  if (!settings.value.isPreviewEnabled || !epubSpineItems?.length) { return null }
  const cut = computePreviewCut(epubSpineItems, settings.value.previewPercentage)
  if (!cut.ok) {
    return { ...cut, message: $t('nft_book_form.preview_unavailable') }
  }
  return {
    ...cut,
    effectivePercentageRounded: Math.round(cut.effectivePercentage),
  }
})

// A refusal is an authoring problem the author can see but we could not count.
// Keyed on the reason itself because the readout recomputes on every tick of
// the percentage slider, and an unguarded watcher would emit a burst per drag.
watch(
  () => (previewCut.value && !previewCut.value.ok ? previewCut.value.reason : ''),
  (reason) => {
    if (reason) { useLogEvent('book_preview_unavailable', { reason }) }
  },
)

// UForm routes each returned error to the UFormField whose name matches
// (prices.{i}.{field}); no per-field :error piping needed.
const formRef = ref()
const formState = computed(() => ({ prices: prices.value }))

function onFormValidate(): FormError[] {
  return validatePriceFormItems(prices.value, $t, reservedNames)
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
