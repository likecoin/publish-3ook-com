<template>
  <div
    :class="[
      'flex',
      'justify-center',
      { 'w-[138px]': props.size === 'large' },
      { 'w-[80px]': props.size === 'small' },
      'mr-[16px]',
      'overflow-hidden',
    ]"
  >
    <img
      v-if="mimeType.startsWith('image/')"
      alt="File preview"
      :class="['w-full', 'h-auto', 'object-contain', 'rounded-[8px]']"
      :src="props.fileData"
    >
    <UIcon
      v-else-if="mimeType === 'application/epub+zip' || mimeType === 'application/pdf'"
      name="i-heroicons-book-open"
      class="text-muted w-[40px] h-[40px]"
    />
    <UIcon
      v-else
      name="i-heroicons-document"
      class="text-muted w-[40px] h-[40px]"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  fileType: {
    type: String,
    default: undefined,
  },
  fileData: { type: String, default: undefined },
  size: { type: String, default: 'large' },
})

const mimeType = computed(() => {
  // If formatted fileType is provided as a prop, use it directly
  if (props.fileType) { return props.fileType }

  // Extract MIME type from data URL
  const dataUrl = props.fileData || ''
  const mimeType = dataUrl.split(';')[0]?.split(':')[1] || ''

  return mimeType
})
</script>
