<template>
  <UDashboardGroup
    unit="px"
    :persistent="false"
    class="print:relative print:inset-auto"
  >
    <AppSidebar />

    <AuthRequiredView>
      <UDashboardPanel :ui="{ root: 'min-h-0', body: 'gap-0 p-0 sm:p-0' }">
        <template #body>
          <slot />
        </template>
      </UDashboardPanel>
    </AuthRequiredView>
  </UDashboardGroup>
</template>

<script setup>
const colorMode = useColorMode()
if (colorMode.value !== 'light') { colorMode.preference = 'light' }
</script>
