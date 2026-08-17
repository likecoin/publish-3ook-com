<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <h3
          class="font-bold font-mono"
          v-text="$t('status_page.sale_state_title')"
        />
        <BookListingStatusBadge :status="listingStatus" />
      </div>
    </template>

    <div class="space-y-4">
      <URadioGroup
        v-model="saleState"
        :disabled="!canEdit || isLocked"
        :items="stateItems"
        orientation="vertical"
        :ui="{ fieldset: 'gap-3' }"
      />

      <!-- The one thing unlisting does not do, said before the author asks. -->
      <p
        v-if="soldCount > 0"
        class="flex items-start gap-1.5 text-sm text-muted"
      >
        <UIcon
          name="i-heroicons-book-open"
          class="mt-0.5 shrink-0"
        />
        <span v-text="$t('status_page.sale_state_sold_copies_keep_access', { count: soldCount })" />
      </p>

      <UAlert
        v-if="lockReason"
        color="neutral"
        variant="subtle"
        icon="i-heroicons-information-circle"
        :description="lockReason"
      />

      <!-- Editions can disagree, and the control writes all of them, so say so
           rather than silently flattening a deliberate mix. Nobody who cannot
           switch needs warning about what switching does. -->
      <UAlert
        v-else-if="isMixed && canEdit"
        color="warning"
        variant="subtle"
        icon="i-heroicons-exclamation-triangle"
        :description="$t('status_page.sale_state_mixed', {
          listed: listedCount,
          hidden: prices.length - listedCount,
        })"
      />

      <div class="flex items-center gap-2 pt-1">
        <UButton
          :to="storeUrl"
          target="_blank"
          variant="soft"
          color="neutral"
          size="sm"
          icon="i-heroicons-arrow-top-right-on-square"
          :label="$t('status_page.view_in_store')"
        />
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-heroicons-document-duplicate"
          :label="$t('status_page.copy_purchase_link')"
          @click="copyToClipboard(storeUrl)"
        />
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { copyToClipboard } from '~/utils'
import type { PriceFormItem } from '~/types/publish'
import { getBookListingStatus, isEditionDraftSoldOut } from '~/utils/listing-status'

const { t: $t } = useI18n()

const { canEdit = false, soldCount = 0, isPendingReview = false, isHiddenByPlatform = false } = defineProps<{
  storeUrl: string
  // Moderators see this tab, but the save bar is the owner's; letting them flip
  // the radio would count changes nothing on the page can save or discard.
  canEdit?: boolean
  soldCount?: number
  isPendingReview?: boolean
  isHiddenByPlatform?: boolean
}>()

// The same edition draft the pricing tab edits, so switching sale state joins
// the pending-changes bar and 放棄 restores it like any other field.
const prices = defineModel<PriceFormItem[]>('prices', { required: true })

const listedCount = computed(() => prices.value.filter(p => p.isListed).length)
const isMixed = computed(() => listedCount.value > 0 && listedCount.value < prices.value.length)

const listingStatus = computed(() => getBookListingStatus({
  isPendingReview,
  isHidden: isHiddenByPlatform,
  hasListedEdition: listedCount.value > 0,
  isSoldOut: isEditionDraftSoldOut(prices.value),
}))

// Moderation and platform hiding are not the author's to undo here. A non-owner
// is disabled separately: this is the locked-and-explained kind, and there is no
// explanation to give someone who is simply reading.
const isLocked = computed(() => isPendingReview || isHiddenByPlatform)
const lockReason = computed(() => {
  if (isPendingReview) { return $t('status_page.sale_state_pending_review_hint') }
  if (isHiddenByPlatform) { return $t('status_page.sale_state_hidden_by_platform') }
  return ''
})

const stateItems = computed(() => [
  {
    value: 'listed',
    label: $t('status_page.sale_state_on_sale'),
    description: $t('status_page.sale_state_on_sale_hint'),
  },
  {
    value: 'unlisted',
    label: $t('status_page.sale_state_unlisted'),
    description: $t('status_page.sale_state_unlisted_hint'),
  },
])

// A book is on sale when any edition is; flipping it writes every edition, so
// a mixed set resolves to whichever state the author picks.
const saleState = computed({
  get: () => (listedCount.value > 0 ? 'listed' : 'unlisted'),
  set: (value: string) => {
    const isListed = value === 'listed'
    // Mutated in place, as every other owner of this array does: the edition
    // field components write back through shared object identity.
    prices.value.forEach((price) => { price.isListed = isListed })
  },
})
</script>
