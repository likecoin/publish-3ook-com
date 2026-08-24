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
      <li
        v-for="(p, index) in prices"
        :key="p.index"
      >
        <!-- overflow-visible so a select or tooltip inside can escape the card;
             everything else is the default card, as on every other pane. -->
        <UCard
          :ui="{
            root: 'overflow-visible',
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
            <!-- Tipping is stored per edition, so it is asked per edition:
                 one class-level checkbox fanning out into every price could
                 only ever overwrite a mix the author had set deliberately. -->
            <UFormField class="flex items-center">
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
    </ul>
  </UForm>
</template>

<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'

import type { FormError } from '#ui/types'
import { DEFAULT_MAX_SUPPLY } from '~/constant'
import type { PriceFormItem } from '~/types/publish'
import { validatePriceFormItems } from '~/utils/listing'

const { t: $t } = useI18n()
const { showErrorToast } = useToastComposable()
const { validateWithFeedback } = useFormValidateFeedback()

const UPLOAD_FILESIZE_MAX = 1 * 1024 * 1024

// The editions of one book, and nothing else: class-level settings and the
// structure around them (add, delete, reorder) belong to the host. 'new' is the
// wizard's single edition; 'edit' is the one being added in the 新增版本 modal;
// 'manage' is every live edition of a published book.
const {
  mode = 'new',
  displayEditIndex = undefined,
  hasExistingSignatureImage = false,
  namePlaceholder = '',
  reservedNames = undefined,
} = defineProps<{
  mode?: 'new' | 'edit' | 'manage'
  displayEditIndex?: number
  hasExistingSignatureImage?: boolean
  namePlaceholder?: string
  // Names already taken by editions this form does not show, so a new one
  // cannot collide with them.
  reservedNames?: string[]
}>()

const prices = defineModel<PriceFormItem[]>('prices', { required: true })
const signatureImage = defineModel<File | null>('signatureImage', { default: null })

const signatureImagePreview = useObjectUrl(signatureImage)
const maxSupply = ref(Number(DEFAULT_MAX_SUPPLY))

// A book with one edition has no edition to choose between, so the price leads
// and the per-edition machinery collapses. Two or more keep the full cards,
// where telling them apart is the whole point. 'edit' stays name-led whatever
// it holds: that modal exists because a second edition is being added, and the
// name is the only thing that will tell it from the first.
const isSingleEditionLayout = computed(() => mode !== 'edit' && prices.value.length === 1)

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
