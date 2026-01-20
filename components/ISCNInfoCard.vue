<template>
  <UCard :ui="{ body: { base: 'space-y-4' } }">
    <template #header>
      <h2 class="font-bold font-mono">
        {{ $t('iscn.information') }}
      </h2>
    </template>

    <UFormGroup :label="$t('iscn.owner')" class="text-left">
      <UButton
        :label="iscnOwner"
        :to="`${OPENSEA_URL}/${encodeURIComponent(iscnOwner)}`"
        target="_blank"
        variant="link"
        :padded="false"
      />
    </UFormGroup>

    <UFormGroup :label="$t('common.title')">
      <UInput
        :model-value="iscnData?.contentMetadata?.name"
        :readonly="true"
        variant="none"
        :padded="false"
      />
    </UFormGroup>

    <UFormGroup v-if="iscnData?.contentMetadata?.alternativeHeadline" :label="$t('iscn_form.subtitle')">
      <UInput
        :model-value="iscnData?.contentMetadata?.alternativeHeadline"
        :readonly="true"
        variant="none"
        :padded="false"
      />
    </UFormGroup>

    <UFormGroup :label="$t('common.description')">
      <UInput
        :model-value="iscnData?.contentMetadata?.description"
        :readonly="true"
        variant="none"
        :padded="false"
      />
    </UFormGroup>

    <UFormGroup v-if="iscnData?.contentMetadata?.descriptionFull" :label="$t('iscn_form.description_full')">
      <UTextarea
        :model-value="iscnData?.contentMetadata?.descriptionFull"
        :readonly="true"
        variant="none"
        :padded="false"
        autoresize
      />
    </UFormGroup>

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
interface ISCNData {
  contentMetadata?: {
    name?: string
    description?: string
    descriptionFull?: string
    alternativeHeadline?: string
  }
}

interface Props {
  iscnId: string
  iscnOwner: string
  iscnData: ISCNData
  showEditButton?: boolean
}

defineProps<Props>()
defineEmits<{(e: 'edit'): void }>()

const { OPENSEA_URL } = useRuntimeConfig().public
</script>
