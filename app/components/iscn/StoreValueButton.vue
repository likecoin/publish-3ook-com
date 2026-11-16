<template>
  <!-- Offered rather than filled in: the store copy is only as fresh as its last refresh,
       so whether it replaces a value the author did set is theirs to decide. -->
  <UButton
    v-if="conflict"
    class="mt-2 max-w-full"
    size="xs"
    variant="soft"
    icon="i-heroicons-building-storefront"
    :label="$t('iscn_form.use_store_value', { value: conflict.storeValue })"
    @click="emit('apply', field)"
  />
</template>

<script setup lang="ts">
import type { StoreMetadataConflict, StoreMetadataDriftField } from '~/utils/store-metadata-drift'

const { field, conflicts = [] } = defineProps<{
  field: StoreMetadataDriftField
  conflicts?: StoreMetadataConflict[]
}>()

const emit = defineEmits<{ apply: [field: StoreMetadataDriftField] }>()

const conflict = computed(() => conflicts.find(entry => entry.field === field))
</script>
