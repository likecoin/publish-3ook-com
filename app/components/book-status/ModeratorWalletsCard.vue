<template>
  <!-- Not a display preference: these wallets pass checkIsAuthorized on the
       API, so they can see a hidden or pending-review book, read owner-only
       sales fields and act on orders. It sits with the orders they can act on. -->
  <UCard
    :ui="{
      header: 'flex justify-between items-center gap-4 flex-wrap',
      body: 'space-y-8 p-0 sm:p-0',
    }"
  >
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('form.share_sales_data')"
      />
      <div
        v-if="canEdit"
        class="flex gap-2"
      >
        <UInput
          v-model="moderatorWalletInput"
          class="font-mono"
          placeholder="0x..."
        />
        <UButton
          :label="$t('common.add')"
          :variant="moderatorWalletInput ? 'outline' : 'solid'"
          :color="moderatorWalletInput ? 'primary' : 'neutral'"
          :disabled="!moderatorWalletInput"
          @click="addModeratorWallet"
        />
      </div>
    </template>
    <UTable
      :columns="moderatorWalletsTableColumns"
      :data="moderatorWalletsTableRows"
    >
      <template #wallet-cell="{ row }">
        <UTooltip :text="row.original.wallet">
          <UButton
            class="font-mono"
            :label="row.original.shortenWallet"
            :to="row.original.walletLink"
            variant="link"
            size="xs"
          />
        </UTooltip>
      </template>
      <template #remove-cell="{ row }">
        <div class="flex justify-end items-center">
          <UButton
            icon="i-heroicons-x-mark"
            variant="soft"
            color="error"
            @click="() => { moderatorWallets.splice(row.original.index, 1) }"
          />
        </div>
      </template>
    </UTable>
  </UCard>
</template>

<script setup lang="ts">
import { getPortfolioURL } from '~/utils'

const { t: $t } = useI18n()

const { canEdit = false } = defineProps<{
  canEdit?: boolean
}>()

const moderatorWallets = defineModel<string[]>({ required: true })
const moderatorWalletInput = ref('')

const moderatorWalletsTableColumns = computed(() => {
  const columns = [{ accessorKey: 'wallet', header: $t('table.wallet') }]
  if (canEdit) {
    columns.push({ accessorKey: 'remove', header: '' })
  }
  return columns
})

const moderatorWalletsTableRows = computed(() => moderatorWallets.value.map((wallet, index) => ({
  index,
  wallet,
  shortenWallet: shortenWalletAddress(wallet),
  walletLink: getPortfolioURL(wallet),
})))

// The save bar cannot see a half-typed address, so an unconfirmed one is
// surfaced to the page instead of being silently dropped on save — and cleared
// with everything else on 放棄, or it would outlive the discard that meant it.
const pendingInput = computed(() => !!moderatorWalletInput.value)
function reset() { moderatorWalletInput.value = '' }
defineExpose({ pendingInput, reset })

function addModeratorWallet() {
  if (!moderatorWalletInput.value) { return }
  moderatorWallets.value.push(moderatorWalletInput.value)
  moderatorWalletInput.value = ''
}
</script>
