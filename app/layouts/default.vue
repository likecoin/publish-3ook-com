<template>
  <UDashboardGroup
    unit="px"
    :persistent="false"
    class="print:relative print:inset-auto"
  >
    <AppSidebar />

    <AuthRequiredView>
      <main class="flex-1 overflow-y-scroll">
        <slot />
      </main>
    </AuthRequiredView>
  </UDashboardGroup>
</template>

<script setup>
const colorMode = useColorMode()
if (colorMode.value !== 'light') {
  colorMode.preference = 'light'
}
</script>
