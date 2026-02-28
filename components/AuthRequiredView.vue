<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <main
      v-if="showLanding"
      class="flex-1 overflow-y-auto"
    >
      <div class="flex flex-col items-center px-6 py-16 sm:py-24">
        <div class="bg-[#131313] p-4">
          <img
            src="~/assets/images/3ook-no-padding.png"
            alt="3ook.com"
            class="w-full max-w-[280px] object-contain"
          >
        </div>

        <p class="mt-8 text-center text-lg text-gray-500 max-w-xl">
          {{ $t('landing.tagline') }}
        </p>

        <UButton
          class="mt-8"
          color="primary"
          :label="$t('auth_state.login')"
          size="xl"
          :loading="isAuthenticating"
          @click="bookstoreApiStore.openLoginPanel()"
        />

        <div class="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10 max-w-xl w-full">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="flex items-start gap-3"
          >
            <UIcon
              :name="feature.icon"
              class="text-[color:var(--ui-primary)] text-xl mt-0.5 shrink-0"
            />
            <div>
              <h3 class="font-semibold text-gray-900 text-sm">
                {{ feature.title }}
              </h3>
              <p class="text-gray-500 text-sm mt-1 leading-relaxed">
                {{ feature.desc }}
              </p>
            </div>
          </div>
        </div>

        <UButton
          class="mt-12"
          variant="link"
          color="primary"
          size="sm"
          :label="`${$t('landing.learn_more')} →`"
          :to="localeRoute({ name: 'about' })"
        />
      </div>
    </main>
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()

const route = useRoute()
const localeRoute = useLocaleRoute()
const bookstoreApiStore = useBookstoreApiStore()
const { isAuthenticating } = useAuth()

const router = useRouter()
const isPublicRoute = ref(route.meta.requiresAuth === false)
const unregisterAfterEach = router.afterEach((to) => {
  isPublicRoute.value = to.meta.requiresAuth === false
})
onUnmounted(unregisterAfterEach)

const showLanding = computed(() => !bookstoreApiStore.isAuthenticated && !isPublicRoute.value)

const features = computed(() => [
  {
    icon: 'i-heroicons-currency-dollar',
    title: $t('landing.feature_revenue_title'),
    desc: $t('landing.feature_revenue_desc')
  },
  {
    icon: 'i-heroicons-bolt',
    title: $t('landing.feature_payout_title'),
    desc: $t('landing.feature_payout_desc')
  },
  {
    icon: 'i-heroicons-megaphone',
    title: $t('landing.feature_affiliate_title'),
    desc: $t('landing.feature_affiliate_desc')
  },
  {
    icon: 'i-heroicons-chart-bar',
    title: $t('landing.feature_analytics_title'),
    desc: $t('landing.feature_analytics_desc')
  }
])
</script>
