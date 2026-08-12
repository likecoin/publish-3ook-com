<template>
  <img
    v-if="canShowImage"
    :src="src"
    :alt="alt"
    :class="SIZE_CLASSES[size].image"
    loading="lazy"
    @error="hasFailedToLoad = true"
  >
  <div
    v-else
    :class="SIZE_CLASSES[size].placeholder"
  >
    <UIcon
      name="i-heroicons-book-open"
      :class="SIZE_CLASSES[size].icon"
    />
  </div>
</template>

<script setup lang="ts">
// `sm` crops to a fixed row-sized box; `lg` keeps the cover's own aspect ratio
// against a placeholder of typical book proportions.
const SIZE_CLASSES = {
  sm: {
    image: 'w-10 h-14 shrink-0 object-cover rounded-sm ring-1 ring-gray-200 dark:ring-gray-700',
    placeholder: 'w-10 h-14 shrink-0 flex items-center justify-center rounded-sm bg-gray-100 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700',
    icon: 'size-5 text-gray-400 dark:text-gray-500',
  },
  lg: {
    image: 'w-[120px] h-auto object-contain self-start rounded border border-default',
    placeholder: 'w-[120px] h-[160px] shrink-0 flex items-center justify-center rounded border border-default bg-elevated',
    icon: 'w-8 h-8 text-dimmed',
  },
} as const

const { src = '', alt = '', size = 'sm' } = defineProps<{
  src?: string
  alt?: string
  size?: keyof typeof SIZE_CLASSES
}>()

// A cover URL that 404s should fall back to the placeholder, and a row
// recycled onto another book must get a fresh chance to load.
const hasFailedToLoad = ref(false)
watch(() => src, () => { hasFailedToLoad.value = false })

const canShowImage = computed(() => !!src && !hasFailedToLoad.value)
</script>
