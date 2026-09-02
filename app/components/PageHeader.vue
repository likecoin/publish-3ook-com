<template>
  <UDashboardNavbar
    :title="title"
    :toggle="false"
    :ui="{
      root: 'sticky top-0 z-10 min-h-[64px] px-5 bg-default',
      title: 'text-xl font-bold',
    }"
  >
    <template
      v-if="$slots.default"
      #default
    >
      <slot />
    </template>
    <template
      v-if="$slots.trailing"
      #trailing
    >
      <slot name="trailing" />
    </template>
    <template #right>
      <slot name="right" />
    </template>
  </UDashboardNavbar>
</template>

<script setup lang="ts">
const { title = '' } = defineProps<{ title?: string }>()
</script>
