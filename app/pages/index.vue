<template>
  <AboutPage />
</template>

<script setup lang="ts">
definePageMeta({ requiresAuth: false })

const { t: $t } = useI18n()
const localeRoute = useLocaleRoute()
const bookstoreApiStore = useBookstoreApiStore()

useSeoMeta({
  title: $t('about.page_title'),
})

// Bounce to my-books only when the site is entered at '/' (isHydrating);
// in-app navigation keeps the home page accessible after login.
if (useNuxtApp().isHydrating) {
  watch(() => bookstoreApiStore.isAuthenticated, (isAuth) => {
    if (isAuth) {
      navigateTo(localeRoute({ name: 'my-books' }), { replace: true })
    }
  }, { immediate: true })
}
</script>
