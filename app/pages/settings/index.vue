<template>
  <PageBody :ui="{ base: 'max-w-3xl! mx-auto pl-6!' }">
    <template v-if="bookstoreApiStore.isAuthenticated">
      <AccountAvatarSection />

      <UAlert
        v-if="!canEditProfile"
        icon="i-heroicons-lock-closed"
        color="neutral"
        variant="soft"
        :title="$t('user_settings.profile_permission_title')"
        :description="$t('user_settings.profile_permission_description')"
        :actions="[{
          label: $t('user_settings.profile_permission_action'),
          color: 'neutral',
          variant: 'solid',
          loading: isRequestingPermission,
          onClick: handleAuthorizeClick,
        }]"
      />

      <AccountIdentityCard />

      <AccountPreferencesCard />

      <AccountStripeConnectCard />
    </template>
  </PageBody>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

const bookstoreApiStore = useBookstoreApiStore()
const { canEditProfile, isRequestingPermission, requestProfilePermission } = useProfilePermission()

async function handleAuthorizeClick() {
  await requestProfilePermission()
}
</script>
