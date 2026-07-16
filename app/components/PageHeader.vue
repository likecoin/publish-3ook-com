<template>
  <SiteHeaderBase class="justify-between w-full px-5">
    <div class="flex items-center gap-2">
      <h1 class="font-bold text-xl">
        {{ props.title }}
      </h1>
    </div>
  </SiteHeaderBase>
</template>

<script setup lang="ts">
const props = defineProps({
  title: {
    type: String,
    default: '',
  },
})
</script>
