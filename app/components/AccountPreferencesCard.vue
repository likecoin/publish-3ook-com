<template>
  <UCard :ui="{ body: 'p-0! sm:p-0! divide-y-1 divide-(--ui-border)' }">
    <AccountSettingsItem
      icon="i-heroicons-language"
      :label="$t('user_settings.locale')"
    >
      <div
        class="text-sm text-(--ui-text-muted)"
        v-text="currentLocaleLabel"
      />

      <template #right>
        <UDropdownMenu
          :items="localeMenuItems"
          :content="{ align: 'end' }"
        >
          <UButton
            :label="$t('common.edit')"
            variant="outline"
            color="neutral"
            trailing-icon="i-heroicons-chevron-down"
          />
        </UDropdownMenu>
      </template>
    </AccountSettingsItem>
  </UCard>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// Theme is deliberately absent: the default layout pins the color mode to
// light on every load, so a switcher here would silently revert.
const { t: $t, locale, locales, setLocale } = useI18n()

const currentLocaleLabel = computed(() => {
  const found = locales.value.find(l => l.code === locale.value)
  return found?.name || found?.code || ''
})

const localeMenuItems = computed<DropdownMenuItem[]>(() =>
  locales.value.map(l => ({
    label: l.name || l.code,
    onSelect: () => {
      useLogEvent('locale_switch', { locale: l.code })
      setLocale(l.code)
    },
  })),
)
</script>
