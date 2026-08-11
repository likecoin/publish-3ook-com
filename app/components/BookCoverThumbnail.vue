<template>
  <div class="w-10 h-14 shrink-0 flex items-center justify-center overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700">
    <img
      v-if="canShowImage"
      :src="src"
      :alt="alt"
      class="w-full h-full object-cover"
      loading="lazy"
      @error="hasFailedToLoad = true"
    >
    <UIcon
      v-else
      name="i-heroicons-book-open"
      class="size-5 text-gray-400 dark:text-gray-500"
    />
  </div>
</template>

<script setup lang="ts">
const { src = '', alt = '' } = defineProps<{
  src?: string
  alt?: string
}>()

// A cover URL that 404s should fall back to the placeholder, and a row
// recycled onto another book must get a fresh chance to load.
const hasFailedToLoad = ref(false)
watch(() => src, () => { hasFailedToLoad.value = false })

const canShowImage = computed(() => !!src && !hasFailedToLoad.value)
</script>
