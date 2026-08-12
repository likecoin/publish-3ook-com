<template>
  <UCard :ui="{ header: 'flex justify-between items-center' }">
    <template #header>
      <h3
        class="font-bold font-mono"
        v-text="$t('publish_review.metadata_title')"
      />
      <UButton
        v-if="editable"
        variant="ghost"
        size="xs"
        icon="i-heroicons-pencil-square"
        :label="$t('publish_review.edit_section')"
        @click="emit('edit')"
      />
    </template>
    <div class="flex gap-4">
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <template
          v-for="row in metadataRows"
          :key="row.label"
        >
          <dt
            class="text-muted"
            v-text="row.label"
          />
          <dd
            class="text-highlighted"
            v-text="row.value || '—'"
          />
        </template>
      </dl>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { ISCNFormData } from '~/types/iscn'
import { resolveShortDescription } from '~/utils/description'
import { MAX_DESCRIPTION_LENGTH } from '~/constant'

const { t: $t } = useI18n()

const { iscnFormData, descriptionFull = '', editable = false } = defineProps<{
  iscnFormData: ISCNFormData
  descriptionFull?: string
  editable?: boolean
}>()

const emit = defineEmits<{ edit: [] }>()

const metadataRows = computed(() => [
  { label: $t('common.title'), value: iscnFormData.title },
  { label: $t('iscn_form.author_name'), value: iscnFormData.author.name },
  { label: $t('form.publisher'), value: iscnFormData.publisher.name },
  { label: $t('form.language'), value: iscnFormData.language },
  { label: $t('form.isbn'), value: iscnFormData.isbn },
  { label: $t('common.description'), value: descriptionFull },
  // What will actually be stored, derived here exactly as publish derives it,
  // so the review is not showing an empty box for a field that gets filled.
  {
    label: $t('iscn_form.description_short'),
    value: resolveShortDescription(
      iscnFormData.description,
      descriptionFull,
      MAX_DESCRIPTION_LENGTH,
    ),
  },
])
</script>
