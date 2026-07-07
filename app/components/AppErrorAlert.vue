<template>
  <UAlert
    v-if="modelValue"
    icon="i-heroicons-exclamation-triangle"
    color="error"
    variant="soft"
    :title="`${modelValue}`"
    :actions="actions"
    :close="{ icon: 'i-heroicons-x-mark-20-solid', color: 'error', variant: 'link' }"
    @close="modelValue = ''"
  />
</template>

<script setup lang="ts">
import type { AlertProps } from '@nuxt/ui'

const modelValue = defineModel<string>({ default: '' })

defineProps<{
  actions?: AlertProps['actions']
}>()
</script>
