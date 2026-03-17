<template>
  <UApp :toaster="{ position: 'top-right' }">
    <MaintenancePage v-if="isShowMaintenancePage" />
    <NuxtLayout v-show="!isShowMaintenancePage">
      <NuxtPage class="grow overflow-y-auto" />
    </NuxtLayout>

    <USlideover
      v-model:open="isMobileMenuOpen"
      side="left"
    >
      <template #content>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-x-mark-20-solid"
          class="absolute top-4 right-4 z-20"
          square
          @click="isMobileMenuOpen = false"
        />
        <SiteNavigation />
      </template>
    </USlideover>

    <UModal
      :open="isRestoringSession"
      :dismissible="false"
    >
      <template #content>
        <div class="p-4 flex flex-col items-center gap-2">
          <span>{{ $t('app.restoring_session') }}</span>
          <UProgress animation="carousel" />
        </div>
      </template>
    </UModal>
    <UModal
      v-model:open="isAuthenticating"
      :dismissible="false"
      class="max-w-[200px]!"
    >
      <template #content>
        <BlockingModal :title="loginStatus" />
      </template>
    </UModal>
    <UModal
      v-model:open="bookstoreApiStore.isShowLoginPanel"
      class="max-w-[348px]!"
    >
      <template #content>
        <LoginPanel
          @connect="authenticateByConnectorId"
        />
      </template>
    </UModal>
    <WelcomeModal />

    <NuxtLoadingIndicator />
  </UApp>
</template>

<script setup lang="ts">
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
    if (isAuthenticated.value && wallet.value) {
      useSetLogUser(wallet.value, { intercomToken: intercomToken.value })
    }
  } catch (error) {
    console.error(error)
    toast.add({
      icon: 'i-heroicons-exclamation-circle',
      title: `${(error as Error).toString()}, please re-login`,
      duration: 0,
      color: 'error'
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
