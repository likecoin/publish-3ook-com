<template>
  <div class="relative flex-1 flex flex-col overflow-hidden">
    <div
      class="flex-1 flex flex-col overflow-hidden transition-opacity duration-500"
      :class="isPendingAuth ? 'opacity-0' : 'opacity-100'"
      :inert="isPendingAuth"
    >
      <AboutPage v-if="isShowAboutPage" />
      <slot v-else />
    </div>

    <Transition
      leave-active-class="transition-opacity duration-500"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isPendingAuth"
        class="fixed inset-0 z-50 flex items-center justify-center bg-white"
        role="status"
        aria-busy="true"
      >
        <BrandLogo
          :height="64"
          class="animate-pulse"
        />
        <span
          class="sr-only"
          v-text="$t('app.restoring_session')"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()
const route = useRoute()
const bookstoreApiStore = useBookstoreApiStore()

const router = useRouter()
const isPublicRoute = ref(route.meta.requiresAuth === false)
const unregisterAfterEach = router.afterEach((to) => {
  isPublicRoute.value = to.meta.requiresAuth === false
})
onUnmounted(unregisterAfterEach)

const isPendingAuth = computed(() =>
  !isPublicRoute.value
  && !bookstoreApiStore.isAuthenticated
  && bookstoreApiStore.isRestoringSession,
)
const isShowAboutPage = computed(() => !bookstoreApiStore.isAuthenticated && !isPublicRoute.value)
</script>
