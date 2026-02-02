<template>
  <div class="flex flex-col items-stretch gap-6">
    <template v-if="bookstoreApiStore.isAuthenticated">
      <div v-if="isFetchingUserLikerInfo" class="flex items-center space-x-4">
        <USkeleton class="h-12 w-12" :ui="{ rounded: 'rounded-full' }" />
        <div class="space-y-2">
          <USkeleton class="h-4 w-[250px]" />
          <USkeleton class="h-4 w-[200px]" />
        </div>
      </div>
      <div v-else class="flex flex-col justify-center items-center gap-1">
        <UAvatar v-if="userLikerInfo" :src="userLikerInfo?.avatar" size="sm" />
        <p
          class="font-mono text-center text-sm truncate text-gray-600 w-full"
          v-text="userLikerInfo?.displayName || userLikerInfo?.user || wallet"
        />
      </div>
      <UButton
        :label="$t('auth_state.sign_out')"
        icon="i-heroicons-arrow-left-on-rectangle"
        color="gray"
        variant="outline"
        size="md"
        block
        @click="onClickDisconnect"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

const store = useWalletStore()
const { wallet } = storeToRefs(store)
const { disconnect } = store
const bookstoreApiStore = useBookstoreApiStore()
const { clearSession } = bookstoreApiStore
const userStore = useUserStore()
const { userLikerInfo, isFetchingUserLikerInfo } = storeToRefs(userStore)

onMounted(async () => {
  if (bookstoreApiStore.isAuthenticated) {
    await userStore.fetchUserLikerInfo()
  }
})

function onClickDisconnect () {
  disconnect()
  clearSession()
}
</script>
