<template>
  <UDashboardSidebar
    v-model:open="isMenuOpen"
    v-model:collapsed="isCollapsed"
    mode="slideover"
    collapsible
    :default-size="256"
    :ui="{
      root: isNavigationCollapsed ? 'hidden lg:hidden' : 'flex',
      header: 'border-b border-default',
      footer: 'border-t border-default',
    }"
  >
    <template #header="{ collapsed }">
      <div
        v-if="!collapsed"
        class="flex items-center gap-1.5 min-w-0 grow"
      >
        <NuxtLink
          :to="localeRoute({ name: 'my-books' })"
          class="inline-flex shrink-0"
        >
          <img
            v-if="isTestnet"
            src="~/assets/images/logo-testnet.svg"
            :alt="$t('app.site_title')"
            class="h-8 w-8"
          >
          <img
            v-else
            src="~/assets/images/logo.svg"
            :alt="$t('app.site_title')"
            class="h-8 w-8"
          >
        </NuxtLink>

        <UBadge
          v-if="isTestnet"
          :label="$t('app.testnet')"
          variant="subtle"
          color="warning"
          size="sm"
          class="rounded-full font-mono"
        />
      </div>

      <UDashboardSidebarCollapse
        variant="ghost"
        :class="collapsed ? 'mx-auto' : ''"
      />

      <!-- Mobile keeps the rail collapsed, so this opens the full labelled
      menu as a slideover instead of expanding inline. -->
      <UButton
        v-if="collapsed"
        icon="i-heroicons-bars-3"
        color="neutral"
        variant="ghost"
        class="lg:hidden mx-auto"
        @click="openMenu"
      />
    </template>

    <template #default="{ collapsed }">
      <UNavigationMenu
        v-for="(items, index) in navigationItems"
        :key="index"
        :collapsed="collapsed"
        :items="items"
        :tooltip="collapsed"
        orientation="vertical"
      />
    </template>

    <template #footer="{ collapsed }">
      <AuthStateView
        class="w-full"
        :collapsed="collapsed"
      />
    </template>
  </UDashboardSidebar>
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

const { t: $t } = useI18n()
const localeRoute = useLocaleRoute()

const { navigationItems } = useSiteMenuItems()
const { isNavigationCollapsed } = useAppLayout()

const isTestnet = getIsTestnet()

const isDesktop = useMediaQuery('(min-width: 1024px)')
const isCollapsed = ref(true)
watch(isDesktop, (desktop) => { isCollapsed.value = !desktop }, { immediate: true })

const isMenuOpen = ref(false)

function openMenu() {
  isMenuOpen.value = true
}
</script>
