<template>
  <!-- The description carries both states, so the switch needs no label of its
       own and the row reads the same whether or not it is on. -->
  <UCard :ui="{ body: 'p-4 sm:p-4' }">
    <div class="flex items-start gap-3">
      <USwitch
        v-model="model"
        class="mt-0.5"
        :name="name"
        :disabled="disabled"
        :aria-label="label"
      />
      <div class="flex flex-col gap-0.5 min-w-0">
        <div
          class="text-highlighted font-semibold"
          v-text="label"
        />
        <div
          class="text-sm text-muted"
          v-text="description"
        />
      </div>
    </div>

    <!-- Settings that only exist while the row is on, e.g. the preview slider. -->
    <div
      v-if="model && $slots.default"
      class="mt-4 pt-4 border-t border-default"
    >
      <slot />
    </div>
  </UCard>
</template>

<script setup lang="ts">
const model = defineModel<boolean>({ required: true })

defineProps<{
  label: string
  description: string
  name?: string
  disabled?: boolean
}>()
</script>
