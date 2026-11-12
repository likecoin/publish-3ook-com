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
      icon="i-heroicons-document-text"
      :label="$t('user_settings.description')"
    >
      <p
        v-if="userLikerInfo?.description"
        class="text-sm whitespace-pre-wrap break-words line-clamp-4"
        v-text="userLikerInfo.description"
      />
      <span
        v-else
        class="text-sm text-(--ui-text-muted)"
        v-text="$t('user_settings.description_not_setup')"
      />

      <template #right>
        <UButton
          :label="$t('common.edit')"
          icon="i-heroicons-pencil-square"
          variant="outline"
          color="neutral"
          :loading="isRequestingPermission || isFetchingUserLikerInfo"
          @click="handleDescriptionEditButtonClick"
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
import { AccountDescriptionModal, AccountDisplayNameModal } from '#components'

const { t: $t } = useI18n()
const { BOOK3_URL } = useRuntimeConfig().public

const { wallet } = storeToRefs(useBookstoreApiStore())
const userStore = useUserStore()
const { userLikerInfo, bookUser, isFetchingUserLikerInfo } = storeToRefs(userStore)
const { showErrorToast } = useToastComposable()
const { isRequestingPermission, requestProfilePermission } = useProfilePermission()

// A `destroyOnClose` overlay leaves `useOverlay`'s shared registry once it has closed,
// so every open needs a fresh instance; one created per mount fails on the second open.
const overlay = useOverlay()

const notificationEmail = computed(() => bookUser.value?.notificationEmail || '')
const isEmailVerified = computed(() => !!bookUser.value?.isEmailVerified)
const accountUrl = computed(() => `${BOOK3_URL}/account`)

async function handleDisplayNameEditButtonClick() {
  useLogEvent('account_display_name_edit_click')
  if (await requestProfilePermission()) {
    overlay.create(AccountDisplayNameModal, { destroyOnClose: true }).open()
  }
}

async function handleDescriptionEditButtonClick() {
  useLogEvent('account_description_edit_click')
  if (!await requestProfilePermission()) { return }
  // The editor is seeded from the loaded profile; opening it earlier
  // would let an untouched save clear the stored description.
  if (!await userStore.lazyFetchUserLikerInfo()) {
    showErrorToast($t('user_settings.profile_load_failed'))
    return
  }
  overlay.create(AccountDescriptionModal, { destroyOnClose: true }).open()
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
