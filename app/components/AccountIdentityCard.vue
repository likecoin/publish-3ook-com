<template>
  <UCard :ui="{ body: 'p-0! sm:p-0! divide-y-1 divide-(--ui-border)' }">
    <AccountSettingsItem
      icon="i-heroicons-user-circle"
      :label="$t('user_settings.display_name')"
    >
      <div
        v-if="userLikerInfo?.displayName"
        class="text-sm font-mono"
        v-text="userLikerInfo.displayName"
      />

      <template #right>
        <UButton
          :label="$t('common.edit')"
          icon="i-heroicons-pencil-square"
          variant="outline"
          color="neutral"
          :loading="isRequestingPermission"
          @click="handleDisplayNameEditButtonClick"
        />
      </template>
    </AccountSettingsItem>

    <AccountSettingsItem
      icon="i-heroicons-envelope"
      :label="$t('user_settings.liker_id_email')"
    >
      <div class="flex items-center gap-2">
        <span
          v-if="notificationEmail"
          class="text-sm"
          v-text="notificationEmail"
        />
        <span
          v-else
          class="text-sm text-(--ui-text-muted)"
          v-text="$t('user_settings.email_not_setup')"
        />
        <UBadge
          v-if="notificationEmail"
          :color="isEmailVerified ? 'success' : 'warning'"
          variant="subtle"
          size="sm"
          :label="isEmailVerified ? $t('user_settings.verified') : $t('user_settings.unverified')"
        />
      </div>

      <template #right>
        <UButton
          :label="$t('user_settings.manage_on_3ook')"
          trailing-icon="i-heroicons-arrow-top-right-on-square"
          :to="accountUrl"
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          color="neutral"
          size="xs"
          @click="handleManageAccountClick"
        />
      </template>
    </AccountSettingsItem>

    <AccountSettingsItem
      v-if="userLikerInfo?.user"
      icon="i-heroicons-identification"
      :label="$t('user_settings.liker_id')"
    >
      <UButton
        class="-ml-2 text-sm font-mono"
        :label="userLikerInfo.user"
        trailing-icon="i-heroicons-clipboard-document"
        variant="ghost"
        color="neutral"
        size="xs"
        @click="handleLikerIdClick"
      />
    </AccountSettingsItem>

    <AccountSettingsItem
      v-if="wallet"
      icon="i-heroicons-key"
      :label="$t('user_settings.evm_wallet')"
    >
      <UTooltip :text="wallet">
        <UButton
          class="-ml-2 text-xs/5 font-mono"
          :label="shortenWalletAddress(wallet)"
          trailing-icon="i-heroicons-clipboard-document"
          variant="ghost"
          color="neutral"
          size="xs"
          @click="handleEVMWalletClick"
        />
      </UTooltip>
    </AccountSettingsItem>
  </UCard>
</template>

<script setup lang="ts">
import { AccountDisplayNameModal } from '#components'

const { t: $t } = useI18n()
const { BOOK3_URL } = useRuntimeConfig().public

const { wallet } = storeToRefs(useBookstoreApiStore())
const userStore = useUserStore()
const { userLikerInfo, bookUser } = storeToRefs(userStore)
const { isRequestingPermission, requestProfilePermission } = useProfilePermission()

// `useOverlay`'s registry is module-level and only drops entries on unmount,
// so an instance created per mount would accumulate across page visits.
const overlay = useOverlay()
const displayNameModal = overlay.create(AccountDisplayNameModal, { destroyOnClose: true })
onUnmounted(() => overlay.unmount(displayNameModal.id))

const notificationEmail = computed(() => bookUser.value?.notificationEmail || '')
const isEmailVerified = computed(() => !!bookUser.value?.isEmailVerified)
const accountUrl = computed(() => `${BOOK3_URL}/account`)

async function handleDisplayNameEditButtonClick() {
  useLogEvent('account_display_name_edit_click')
  if (await requestProfilePermission()) {
    displayNameModal.open()
  }
}

function handleManageAccountClick() {
  useLogEvent('account_manage_email_click')
}

function handleLikerIdClick() {
  useLogEvent('account_liker_id_copy')
  copyToClipboard(userLikerInfo.value?.user || '', $t('user_settings.liker_id_copied'))
}

function handleEVMWalletClick() {
  useLogEvent('account_evm_wallet_copy')
  copyToClipboard(wallet.value, $t('user_settings.evm_wallet_copied'))
}
</script>
