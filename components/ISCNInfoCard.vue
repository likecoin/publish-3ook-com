<template>
  <UCard :ui="{ body: 'space-y-4' }">
    <template #header>
      <h2 class="font-bold font-mono">
        {{ $t('iscn.information') }}
      </h2>
    </template>

    <UFormField :label="$t('iscn.owner')" class="text-left">
      <UButton
        :label="iscnOwner"
        :to="`${OPENSEA_URL}/${encodeURIComponent(iscnOwner)}`"
        target="_blank"
        variant="link"
      />
    </UFormField>

    <UFormField :label="$t('common.title')">
      <UInput
        :model-value="iscnData?.contentMetadata?.name"
        :readonly="true"
        variant="none"
      />
    </UFormField>

    <UFormField v-if="iscnData?.contentMetadata?.alternativeHeadline" :label="$t('iscn_form.subtitle')">
      <UInput
        :model-value="iscnData?.contentMetadata?.alternativeHeadline"
        :readonly="true"
        variant="none"
      />
    </UFormField>

    <UFormField :label="$t('common.description')">
      <UInput
        :model-value="iscnData?.contentMetadata?.description"
        :readonly="true"
        variant="none"
      />
    </UFormField>

    <UFormField v-if="iscnData?.contentMetadata?.descriptionFull" :label="$t('iscn_form.description_full')">
      <UTextarea
        :model-value="iscnData?.contentMetadata?.descriptionFull"
        :readonly="true"
        variant="none"
        autoresize
      />
    </UFormField>

    <UFormField v-if="previewContent" :label="$t('iscn_form.preview_content')">
      <UTextarea
        :model-value="previewContent"
        :readonly="true"
        variant="none"
        autoresize
      />
    </UFormField>

    <slot name="actions">
      <UButton
        v-if="showEditButton"
        :label="$t('iscn.edit_metadata')"
        @click="$emit('edit')"
      />
    </slot>
  </UCard>
</template>

<script setup lang="ts">
import type { ISCNData } from '~/types'
import { getPreviewContentFromHasPart } from '~/utils/iscn'

interface Props {
  iscnId: string
  iscnOwner: string
  iscnData: ISCNData
  showEditButton?: boolean
}

const props = defineProps<Props>()
defineEmits<{(e: 'edit'): void }>()

const { OPENSEA_URL } = useRuntimeConfig().public

const previewContent = computed(() => {
  return getPreviewContentFromHasPart(props.iscnData?.contentMetadata?.hasPart)
})
</script>
