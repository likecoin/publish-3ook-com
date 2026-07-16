<template>
  <ul class="space-y-10">
    <li
      v-for="group in groups"
      :key="group.label"
    >
      <UCard>
        <template #header>
          <h3 class="text-sm font-bold font-mono">
            {{ group.label }}
          </h3>
        </template>

        <ul class="flex flex-wrap gap-4">
          <li
            v-for="link in group.links"
            :key="link.label"
          >
            <UButton
              :label="link.label"
              :leading-icon="link.icon"
              size="xl"
              :to="link.to"
              :target="link.target"
              color="neutral"
              variant="outline"
              @click="link.onSelect"
            />
          </li>
        </ul>
      </UCard>
    </li>
  </ul>
</template>

<script setup lang="ts">
const { groups } = useSiteMenuItems()
</script>
