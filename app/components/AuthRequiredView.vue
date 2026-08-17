<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <AboutPage v-if="isShowAboutPage" />
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const bookstoreApiStore = useBookstoreApiStore()

const router = useRouter()
const isPublicRoute = ref(route.meta.requiresAuth === false)
const unregisterAfterEach = router.afterEach((to) => {
  isPublicRoute.value = to.meta.requiresAuth === false
})
onUnmounted(unregisterAfterEach)

const isShowAboutPage = computed(() => !bookstoreApiStore.isAuthenticated && !isPublicRoute.value)
</script>
