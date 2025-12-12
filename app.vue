<template>
  <div>
    <MaintenancePage v-if="isShowMaintenancePage" />
    <NuxtLayout v-else>
      <NuxtPage class="grow overflow-y-auto" />
    </NuxtLayout>

    <USlideover
      v-model="isMobileMenuOpen"
      side="left"
    >
      <UButton
        color="gray"
        variant="ghost"
        icon="i-heroicons-x-mark-20-solid"
        class="absolute top-4 right-4 z-20"
        square
        padded
        @click="isMobileMenuOpen = false"
      />
      <SiteNavigation />
    </USlideover>

    <UModal
      :model-value="isRestoringSession"
      :prevent-close="true"
      :ui="{ base: 'p-4 items-center gap-2' }"
    >
      <span>{{ $t('app.restoring_session') }}</span>
      <UProgress animation="carousel" />
    </UModal>
    <UModal
      v-model="isAuthenticating"
      prevent-close
      :ui="{ width: '!max-w-[200px]' }"
    >
      <BlockingModal :title="loginStatus" />
    </UModal>
    <UModal
      v-model="bookstoreApiStore.isShowLoginPanel"
      :close="{ onClick: () => bookstoreApiStore.closeLoginPanel() }"
      :ui="{ width: '!max-w-[348px]' }"
    >
      <LoginPanel
        @connect="authenticateByConnectorId"
      />
    </UModal>
    <WelcomeModal />

    <NuxtLoadingIndicator />

    <UNotifications />
    <UModals />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useBookstoreApiStore } from '~/stores/book-store-api'
import { useUIStore } from '~/stores/ui'
const { t: $t } = useI18n()

const { SITE_URL } = useRuntimeConfig().public
const { isShowMaintenancePage } = useMaintenanceMode()
const bookstoreApiStore = useBookstoreApiStore()

const { restoreAuthSession, fetchBookListing, clearSession } = bookstoreApiStore
const { wallet, intercomToken, isAuthenticated } = storeToRefs(bookstoreApiStore)
const { isAuthenticating, loginStatus, authenticateByConnectorId, authenticateBySignature } = useAuth()
const uiStore = useUIStore()
const toast = useToast()

const isRestoringSession = ref(false)

const isMobileMenuOpen = computed({
  get: () => uiStore.isSiteMenuOpen,
  set: value => uiStore.setSiteMenuOpen(value)
})

const route = useRoute()
const router = useRouter()

// NOTE: Close mobile menu on route change
watch(
  () => route.fullPath,
  () => {
    isMobileMenuOpen.value = false
  }
)

watch(() => bookstoreApiStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated && bookstoreApiStore.isShowLoginPanel) {
    bookstoreApiStore.closeLoginPanel()
  }
})

useHead({
  htmlAttrs: {
    class: 'h-dvh'
  },
  bodyAttrs: {
    class: 'h-dvh text-gray-700 dark:text-gray-200 dark:bg-gray-900'
  },
  link: [
    {
      rel: 'icon',
      type: 'image/x-icon',
      href: `${SITE_URL}/favicon.ico`
    }
  ]
})

useSeoMeta({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - ${$t('app.site_title')}` : $t('app.site_title')
  },
  ogTitle: () => $t('app.site_title'),
  description: () => $t('app.site_description'),
  ogDescription: () => $t('app.site_description'),
  ogType: 'website',
  ogSiteName: () => $t('app.site_title'),
  themeColor: '#28646e'
})

onMounted(async () => {
  isRestoringSession.value = true
  try {
    await restoreAuthSession()
    if (window.Intercom && intercomToken.value) {
      window.Intercom('update', {
        intercom_user_jwt: intercomToken.value,
        session_duration: 2592000000, // 30d
        evm_wallet: wallet.value
      })
    }
  } catch (error) {
    console.error(error)
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: `${(error as Error).toString()}, please re-login`,
      timeout: 0,
      color: 'red',
      ui: {
        title: 'text-red-400 dark:text-red-400'
      }
    })
    clearSession()
  } finally {
    isRestoringSession.value = false
  }

  if (isAuthenticated.value) {
    try {
      await fetchBookListing()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    }
  } else if (route.query.auth) {
    const { auth: payload, ...query } = route.query
    if (typeof payload === 'string') {
      try {
        const {
          signature,
          message,
          wallet,
          signMethod,
          expiresIn
        } = JSON.parse(payload)
        if (signature && message && wallet) {
          await authenticateBySignature({
            signature,
            message,
            wallet,
            signMethod,
            expiresIn
          })
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('An error occurred when authenticating with signature from query string', error)
      }
    }
    router.replace({ query })
  }
})

</script>
