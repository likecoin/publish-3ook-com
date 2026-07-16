<template>
  <UContainer :class="containerClass">
    <slot />
  </UContainer>
</template>

<script setup lang="ts">
import { twMerge } from 'tailwind-merge'

const props = defineProps<{
  ui?: {
    base?: string
    padding?: string
    constrained?: string
  }
}>()

const containerClass = computed(() => twMerge(
  'space-y-6 max-w-full! pt-6 pb-20 pl-8!',
  props?.ui?.base,
  props?.ui?.padding,
  props?.ui?.constrained,
))
</script>
