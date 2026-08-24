<template>
  <!-- The wizard's half of the book page's 販售與內容設定 card, plus the two
       things only an unpublished book can show. -->
  <UCard :ui="{ body: 'p-4 flex flex-col gap-4' }">
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('nft_book_form.sale_settings')"
      />
    </template>

    <BookSettingsFields
      v-model:is-adult-only="settings.isAdultOnly"
      v-model:hide-audio="settings.hideAudio"
      v-model:is-preview-enabled="settings.isPreviewEnabled"
      v-model:preview-percentage="settings.previewPercentage"
    />

    <!-- Live free-preview cut readout: the straddled chapter is included in
         full where that stays under the ceiling, so the actual range can
         exceed the nominal %; past it the chapter ships part-way. -->
    <div
      v-if="previewCut"
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

    <!-- Stripe connect list -->
    <UFormField :label="$t('nft_book_form.stripe_connect_wallets')">
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
  </UCard>
</template>

<script setup lang="ts">
import type { EpubSpineItem } from '~/types'
import type { PricingFormSettings } from '~/types/publish'

const { t: $t } = useI18n()

const stripeStore = useStripeStore()
const { fetchStripeConnectStatusByWallet } = stripeStore
const { getStripeConnectStatusByWallet } = storeToRefs(stripeStore)
const bookstoreApiStore = useBookstoreApiStore()
const { wallet: sessionWallet } = storeToRefs(bookstoreApiStore)

const { epubSpineItems = undefined } = defineProps<{
  // Spine table of the uploaded EPUB, for the free-preview cut readout.
  epubSpineItems?: EpubSpineItem[]
}>()

// A model, not a prop: this card edits the wizard's draft object in place, which
// vue/no-mutating-props forbids through a prop. The book page's card takes a bag
// of refs instead, which is why it can.
const settings = defineModel<PricingFormSettings>('settings', { required: true })

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

const stripeConnectWallets = computed(() => Object.keys(settings.value.connectedWallets || {}))
const sessionWalletStripeStatus = computed(() => {
  if (!sessionWallet.value) { return null }
  return getStripeConnectStatusByWallet.value(sessionWallet.value)
})

onMounted(async () => {
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
</script>
