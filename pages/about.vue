<template>
  <main class="flex-1 overflow-y-auto">
    <!-- Hero Section (dark, matching 3ook.com) -->
    <section class="flex flex-col justify-center items-center text-center space-y-8 min-h-[50vh] px-6 py-16 bg-[#131313]">
      <img
        src="~/assets/images/3ook-no-padding.png"
        alt="3ook.com"
        class="w-full max-w-[240px] object-contain"
      >

      <div class="space-y-4 text-gray-100 max-w-3xl">
        <h1 class="text-3xl md:text-4xl font-bold">
          {{ $t('about.hero_title') }}
        </h1>
        <p class="text-lg leading-relaxed">
          {{ $t('about.hero_description') }}
        </p>
      </div>

      <p class="text-gray-400 text-sm max-w-2xl">
        {{ $t('about.hero_subtitle') }}
      </p>
    </section>

    <!-- Stats Bar (light bg, matching 3ook.com) -->
    <section class="w-full bg-gray-50 border-y border-gray-200 py-8">
      <div class="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 md:gap-16 px-4">
        <div class="text-center">
          <p class="text-3xl font-bold text-[color:var(--ui-primary)]">
            1,000+
          </p>
          <p class="text-sm text-gray-500">
            {{ $t('about.stats_books') }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-3xl font-bold text-[color:var(--ui-primary)]">
            200,000+
          </p>
          <p class="text-sm text-gray-500">
            {{ $t('about.stats_users') }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-3xl font-bold text-[color:var(--ui-primary)]">
            90%*
          </p>
          <p class="text-sm text-gray-500">
            {{ $t('about.stats_revenue') }}
          </p>
        </div>
      </div>
      <p class="text-center text-gray-400 text-xs mt-2">
        {{ $t('about.stats_note') }}
      </p>
    </section>

    <!-- Main content (light bg) -->
    <div class="w-full max-w-4xl mx-auto px-4 pt-12 pb-16 space-y-16">
      <!-- Key Features Section -->
      <section class="space-y-6">
        <div class="grid md:grid-cols-2 gap-6">
          <UCard
            v-for="feat in mainFeatures"
            :key="feat.title"
            class="p-6 space-y-3"
          >
            <div class="flex items-center gap-3">
              <UIcon
                :name="feat.icon"
                size="24"
                class="text-[color:var(--ui-primary)]"
              />
              <h3 class="text-lg font-semibold text-gray-900">
                {{ feat.title }}
              </h3>
            </div>
            <p class="mt-4 text-gray-700">
              {{ feat.desc }}
            </p>
          </UCard>
        </div>
      </section>

      <!-- More Features -->
      <section class="space-y-6">
        <h2 class="text-2xl font-bold text-gray-900 text-center">
          {{ $t('about.more_features_title') }}
        </h2>
        <div class="space-y-4 max-w-2xl mx-auto">
          <div
            v-for="item in moreFeatures"
            :key="item.icon"
            class="flex items-start gap-3"
          >
            <UIcon
              :name="item.icon"
              class="text-[color:var(--ui-primary)] text-lg mt-0.5 shrink-0"
            />
            <p class="text-gray-700">
              <template v-if="item.link">
                <a
                  :href="item.link"
                  target="_blank"
                  rel="noopener"
                  class="font-semibold text-[color:var(--ui-primary)] hover:underline"
                >{{ item.linkText }}</a>{{ item.suffix }}
              </template>
              <template v-else>
                {{ item.text }}
              </template>
            </p>
          </div>
        </div>
      </section>

      <!-- Link to 3ook.com/about -->
      <section class="text-center">
        <UButton
          :to="`${BOOK3_URL}/about`"
          target="_blank"
          :label="$t('about.3ook_about_link')"
          variant="outline"
          color="primary"
          size="lg"
          trailing-icon="i-heroicons-arrow-top-right-on-square-20-solid"
        />
      </section>

      <!-- CTA Section -->
      <UCard :ui="{ body: 'sm:py-12' }">
        <div class="space-y-4 text-center">
          <h2 class="text-2xl font-bold text-gray-900">
            {{ $t('about.cta_title') }}
          </h2>
          <div>
            <UButton
              color="primary"
              :label="$t('about.cta_button')"
              size="xl"
              :loading="isAuthenticating"
              @click="handleCTA"
            />
          </div>
          <p class="text-gray-500 text-sm">
            {{ $t('about.cta_contact') }}
            <a
              href="mailto:publish@3ook.com"
              class="text-[color:var(--ui-primary)] hover:underline"
              @click.prevent="handleContact"
            >publish@3ook.com</a>
          </p>
        </div>
      </UCard>
    </div>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ requiresAuth: false })

const { t: $t } = useI18n()

const localeRoute = useLocaleRoute()
const bookstoreApiStore = useBookstoreApiStore()
const { isAuthenticating } = useAuth()
const { BOOK3_URL } = useRuntimeConfig().public

useSeoMeta({
  title: $t('about.page_title')
})

const mainFeatures = computed(() => [
  {
    icon: 'i-heroicons-globe-alt',
    title: $t('about.feat1_title'),
    desc: $t('about.feat1_desc')
  },
  {
    icon: 'i-heroicons-chart-bar-square',
    title: $t('about.feat2_title'),
    desc: $t('about.feat2_desc')
  },
  {
    icon: 'i-heroicons-heart',
    title: $t('about.feat3_title'),
    desc: $t('about.feat3_desc')
  },
  {
    icon: 'i-heroicons-rocket-launch',
    title: $t('about.feat4_title'),
    desc: $t('about.feat4_desc')
  }
])

const IBO_URL = 'https://weekly.dhk.org/p/ibo'
const moreFeatures = computed(() => [
  {
    icon: 'i-heroicons-rocket-launch',
    link: IBO_URL,
    linkText: $t('about.more_ibo_link'),
    suffix: $t('about.more_ibo_suffix')
  },
  { icon: 'i-heroicons-arrow-path', text: $t('about.more_market') },
  { icon: 'i-heroicons-speaker-wave', text: $t('about.more_ai') }
])

function handleCTA () {
  if (bookstoreApiStore.isAuthenticated) {
    navigateTo(localeRoute({ name: 'my-books' }))
  } else {
    bookstoreApiStore.openLoginPanel()
  }
}

function handleContact () {
  if (window.Intercom) {
    window.Intercom('showNewMessage', $t('about.cta_intercom_message'))
  } else {
    window.location.href = 'mailto:publish@3ook.com'
  }
}
</script>
