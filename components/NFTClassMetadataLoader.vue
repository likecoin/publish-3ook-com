<template>
  <slot :is-loading="isLoading" />
</template>

<script setup lang="ts">
const nftStore = useNftStore()

const props = defineProps({
  classId: {
    type: String,
    required: true
  }
})

const isLoading = ref(false)

onMounted(async () => {
  try {
    isLoading.value = true
    await nftStore.lazyFetchClassMetadataById(props.classId)
  } catch {
    // ignore
  } finally {
    isLoading.value = false
  }
})
</script>
