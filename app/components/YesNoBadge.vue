<template>
  <UBadge
    :color="value ? 'primary' : 'neutral'"
    variant="soft"
  >
    {{ value ? $t('common.yes') : $t('common.no') }}
  </UBadge>
</template>

<script setup lang="ts">
defineProps<{
  value: boolean
}>()
</script>
