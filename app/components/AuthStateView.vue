<template>
  <div class="flex flex-col items-stretch gap-2">
    <template v-if="bookstoreApiStore.isAuthenticated">
      <div
        v-if="isFetchingUserLikerInfo"
        class="flex items-center gap-3"
        :class="{ 'justify-center': collapsed }"
      >
        <USkeleton class="h-8 w-8 rounded-full shrink-0" />
        <USkeleton
          v-if="!collapsed"
          class="h-4 flex-1"
        />
      </div>
      <UTooltip
        v-else
        :text="collapsed ? displayName : undefined"
        :disabled="!collapsed"
      >
        <UButton
          :avatar="{ src: userLikerInfo?.avatar, loading: 'lazy' }"
          :label="collapsed ? undefined : displayName"
          :to="accountUrl"
          target="_blank"
          rel="noopener noreferrer"
          color="neutral"
          variant="ghost"
          size="md"
          :square="collapsed"
          block
          @click="onClickAccount"
        />
      </UTooltip>
      <UTooltip
        :text="collapsed ? $t('auth_state.sign_out') : undefined"
        :disabled="!collapsed"
      >
        <UButton
          :label="collapsed ? undefined : $t('auth_state.sign_out')"
          icon="i-heroicons-arrow-left-on-rectangle"
          color="neutral"
          variant="outline"
          size="md"
          :square="collapsed"
          block
          @click="onClickDisconnect"
        />
      </UTooltip>
    </template>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

const { collapsed = false } = defineProps<{ collapsed?: boolean }>()

const { BOOK3_URL } = useRuntimeConfig().public

const store = useWalletStore()
const { wallet } = storeToRefs(store)
const { disconnect } = store
const bookstoreApiStore = useBookstoreApiStore()
const { clearSession } = bookstoreApiStore
const userStore = useUserStore()
const { userLikerInfo, isFetchingUserLikerInfo } = storeToRefs(userStore)

const displayName = computed(() => userLikerInfo.value?.displayName || userLikerInfo.value?.user || wallet.value)
const accountUrl = computed(() => `${BOOK3_URL}/account`)

onMounted(async () => {
  if (bookstoreApiStore.isAuthenticated) {
    await userStore.fetchUserLikerInfo()
  }
})

function onClickAccount() {
  useLogEvent('site_menu_click_account')
}

function onClickDisconnect() {
  useLogEvent('logout')
  useSetLogUser(null)
  disconnect()
  clearSession()
}
</script>
