<template>
  <UCard :ui="{ body: 'flex justify-between items-center gap-4 flex-wrap' }">
    <div class="space-y-1">
      <h3
        class="font-bold font-mono"
        v-text="$t('ownership_transfer.title')"
      />
      <p
        class="text-sm text-muted"
        v-text="$t('ownership_transfer.description')"
      />
    </div>
    <UButton
      :label="$t('ownership_transfer.button')"
      color="error"
      variant="outline"
      icon="i-heroicons-arrows-right-left"
      @click="isOpen = true"
    />

    <UModal
      v-model:open="isOpen"
      :title="$t('ownership_transfer.modal_title')"
      :dismissible="!step"
      :close="!step"
      :ui="{
        title: 'text-lg font-bold',
        body: 'space-y-4',
        footer: 'flex justify-end gap-3',
      }"
      @after:leave="reset"
    >
      <template #body>
        <UFormField
          :label="$t('ownership_transfer.input_label')"
          :error="inputError"
        >
          <div class="flex gap-2">
            <UInput
              v-model="input"
              class="w-full font-mono"
              autofocus
              :placeholder="$t('ownership_transfer.input_placeholder')"
              :disabled="!!step"
              @keydown.enter="lookUpRecipient"
            />
            <UButton
              :label="$t('ownership_transfer.lookup')"
              variant="outline"
              :loading="isLookingUp"
              :disabled="!input.trim() || !!step"
              @click="lookUpRecipient"
            />
          </div>
        </UFormField>

        <div
          v-if="recipient"
          class="flex items-center gap-3 p-3 rounded-md bg-elevated"
        >
          <UAvatar
            :src="recipient.avatar || undefined"
            :alt="recipient.displayName"
            size="lg"
          />
          <div class="min-w-0">
            <p
              class="text-xs text-muted"
              v-text="$t('ownership_transfer.recipient_title')"
            />
            <p
              class="font-bold truncate"
              v-text="recipient.displayName"
            />
            <p
              class="text-xs text-muted font-mono break-all"
              v-text="`@${recipient.likerId} · ${recipient.wallet}`"
            />
          </div>
        </div>

        <UAlert
          color="warning"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          :title="$t('ownership_transfer.consequences_title')"
        >
          <template #description>
            <ul class="list-disc pl-4 space-y-1">
              <li v-text="$t('ownership_transfer.consequence_manage')" />
              <li v-text="$t('ownership_transfer.consequence_revenue')" />
              <li v-text="$t('ownership_transfer.consequence_reserved_nft')" />
              <li v-text="$t('ownership_transfer.consequence_irreversible')" />
            </ul>
          </template>
        </UAlert>

        <UCheckbox
          v-model="isAcknowledged"
          :label="$t('ownership_transfer.confirm_checkbox')"
          :disabled="!!step"
        />
      </template>

      <template #footer>
        <p
          v-if="step"
          class="mr-auto self-center text-sm text-muted"
          v-text="$t(`ownership_transfer.step_${step}`)"
        />
        <UButton
          :label="$t('common.cancel')"
          variant="outline"
          color="neutral"
          :disabled="!!step"
          @click="isOpen = false"
        />
        <UButton
          :label="$t('ownership_transfer.submit')"
          color="error"
          :loading="!!step"
          :disabled="!recipient || !isAcknowledged"
          @click="transfer"
        />
      </template>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
import { isSameWallet, OwnershipTransferPendingError, parseOwnershipTransferInput } from '~/utils/ownership-transfer'

const { classId, ownerWallet, needsStripeConnect = false } = defineProps<{
  classId: string
  ownerWallet: string
  // The owner's payout share moves with the book, and the API refuses to move
  // it onto a wallet Stripe cannot pay out to.
  needsStripeConnect?: boolean
}>()

const emit = defineEmits<{
  transferred: [recipient: string]
  // The chain has moved but the listing has not; the page offers the retry.
  syncNeeded: [newOwnerWallet: string, txHash?: `0x${string}`]
  // Broadcast with no outcome yet; the page waits on the chain before allowing another try.
  confirmationPending: [newOwnerWallet: string]
}>()

const { t: $t } = useI18n()
const likerStore = useLikerStore()
const stripeStore = useStripeStore()
const { showErrorToast } = useToastComposable()
const { transferOnChain, transferReservedNftOrWarn, syncOwnership, fetchPendingSyncWallet } = useBookOwnershipTransfer()

interface Recipient {
  wallet: `0x${string}`
  likerId: string
  displayName: string
  avatar: string
}

const isOpen = ref(false)
const input = ref('')
const inputError = ref('')
const isLookingUp = ref(false)
const recipient = ref<Recipient | null>(null)
const isAcknowledged = ref(false)
const step = ref<'signing' | 'confirming' | 'syncing' | 'reserved_nft' | null>(null)

// A recipient confirmed for one input must not carry over to an edited one.
watch(input, () => {
  recipient.value = null
  inputError.value = ''
})

function reset() {
  input.value = ''
  isAcknowledged.value = false
}

async function lookUpRecipient() {
  if (isLookingUp.value || step.value) { return }
  // Only the current lookup may enable the transfer: a Stripe status can lapse between two.
  recipient.value = null
  inputError.value = ''
  const target = parseOwnershipTransferInput(input.value)
  if (!target) {
    inputError.value = $t('ownership_transfer.error_invalid_input')
    return
  }
  const requestedInput = input.value
  isLookingUp.value = true
  try {
    // Uncached: a cached profile can outlive a deleted account.
    const info = target.type === 'wallet'
      ? await likerStore.fetchLikerInfoByWallet(target.wallet, { nocache: true })
      : await likerStore.fetchLikerInfoById(target.likerId, { nocache: true })
    const wallet = target.type === 'wallet' ? target.wallet : info?.evmWallet as `0x${string}` | undefined
    const stripeStatus = needsStripeConnect && wallet
      ? await stripeStore.fetchStripeConnectStatusByWallet(wallet).catch(() => null)
      : null
    // An answer for an input since edited, or a closed modal, must not pick the recipient.
    if (input.value !== requestedInput || !isOpen.value) { return }
    // An unregistered wallet is refused: a typo here hands the book to nobody, for good.
    if (!info || !wallet) {
      inputError.value = $t('ownership_transfer.error_not_found')
      return
    }
    if (isSameWallet(wallet, ownerWallet)) {
      inputError.value = $t('ownership_transfer.error_self')
      return
    }
    if (needsStripeConnect && !stripeStatus?.isReady) {
      inputError.value = $t('ownership_transfer.error_stripe_connect_not_ready')
      return
    }
    recipient.value = {
      wallet,
      likerId: info.user,
      displayName: info.displayName || info.user,
      avatar: info.avatar,
    }
  }
  finally {
    isLookingUp.value = false
  }
}

async function transfer() {
  const target = recipient.value
  if (!target || !isAcknowledged.value || step.value) { return }
  let txHash: `0x${string}` | undefined
  try {
    step.value = 'signing'
    txHash = await transferOnChain({
      classId,
      newOwnerWallet: target.wallet,
      onSubmitted: () => { step.value = 'confirming' },
    })
    step.value = 'syncing'
    await syncOwnership(classId, { newOwnerWallet: target.wallet, txHash })
    useLogEvent('book_ownership_transfer_success', { class_id: classId })
    step.value = 'reserved_nft'
    await transferReservedNftOrWarn({
      classId,
      fromWallet: ownerWallet as `0x${string}`,
      toWallet: target.wallet,
    })
    isOpen.value = false
    emit('transferred', target.displayName)
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    isOpen.value = false
    const isPending = error instanceof OwnershipTransferPendingError
    if (!isPending) {
      showErrorToast(error)
    }
    // A sponsored call can fail after broadcast, so ask the chain, not the error.
    // A confirmed hash already proves the move, so a failed read must not drop it.
    const pendingWallet = await fetchPendingSyncWallet({
      classId,
      listingOwner: ownerWallet,
      sessionWallet: ownerWallet,
    }).catch(() => (txHash ? target.wallet : null))
    if (pendingWallet) {
      emit('syncNeeded', pendingWallet, isSameWallet(pendingWallet, target.wallet) ? txHash : undefined)
    }
    else if (isPending) {
      emit('confirmationPending', target.wallet)
    }
  }
  finally {
    step.value = null
  }
}
</script>
