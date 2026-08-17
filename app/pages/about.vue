<template>
  <AboutPage />
</template>

<script setup lang="ts">
// The about content now lives on the home page; keep /about as a redirect.
definePageMeta({ requiresAuth: false })

const localeRoute = useLocaleRoute()

// Client-only so prerendering still generates this page during yarn generate
if (import.meta.client) {
  await navigateTo(localeRoute({ name: 'index' }), { replace: true })
}
</script>
