<template>
  <div class="grid grid-cols-10 items-center gap-x-3 gap-y-1 px-4 py-3">
    <div
      :class="[
        'flex items-center shrink-0 gap-2 sm:col-span-3 sm:min-h-8 text-(--ui-text-muted)',
        shouldStackColumnsOnMobile ? 'col-span-full' : 'col-span-4 min-h-8',
      ]"
    >
      <slot
        v-if="$slots['label-prepend']"
        name="label-prepend"
      />
      <UIcon
        v-else-if="icon"
        :name="icon"
        class="size-5 shrink-0"
      />

      <span
        class="text-sm font-semibold"
        v-text="label"
      />

      <slot name="label-append" />
    </div>

    <div
      :class="[
        'flex items-center flex-wrap gap-x-3 gap-y-1 sm:col-span-7',
        !hasDefaultContent && hasRightContent ? 'justify-end' : 'justify-between',
        // Both slots present means the row stacks, so the value takes the full width
        shouldStackColumnsOnMobile ? 'col-span-full' : 'col-span-6',
      ]"
    >
      <div
        v-if="hasDefaultContent"
        :class="[
          'flex items-center grow',
          { 'max-sm:justify-end max-sm:text-right': !hasRightContent },
        ]"
      >
        <slot name="default" />
      </div>

      <div
        v-if="hasRightContent"
        class="flex sm:justify-end items-center"
      >
        <slot name="right" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Comment, Text, type Slot } from 'vue'

defineProps<{
  icon?: string
  label: string
}>()

const slots = useSlots()

function checkSlotHasContent(slot?: Slot) {
  return !!slot?.().some((vnode) => {
    // a `v-if="false"` slot still renders a comment node
    if (vnode.type === Comment) { return false }
    if (vnode.type === Text) { return !!String(vnode.children ?? '').trim() }
    return true
  })
}

const hasDefaultContent = computed(() => checkSlotHasContent(slots.default))
const hasRightContent = computed(() => checkSlotHasContent(slots.right))

const shouldStackColumnsOnMobile = computed(() => hasDefaultContent.value && hasRightContent.value)
</script>
