<template>
  <div class="flex flex-col gap-[16px] text-left">
    <UCard>
      <template #header>
        <h3
          class="font-bold font-mono"
          v-text="$t('publish_review.files_title')"
        />
      </template>

      <UProgress
        v-if="isLoading"
        animation="carousel"
        color="primary"
        class="w-full"
      />

      <div
        v-else
        class="flex gap-6"
      >
        <div class="flex flex-col gap-2 items-start">
          <p
            class="text-sm text-muted"
            v-text="$t('form.cover_image')"
          />
          <BookCoverThumbnail
            :src="coverUrl"
            size="lg"
          />
        </div>

        <ul
          v-if="fileRows.length"
          class="grow space-y-2 self-start"
        >
          <li
            v-for="file in fileRows"
            :key="file.url"
            class="flex items-center gap-3 text-sm"
          >
            <UBadge
              variant="soft"
              color="neutral"
              size="xs"
              class="uppercase"
            >
              {{ file.type || '?' }}
            </UBadge>
            <span
              class="font-medium text-highlighted break-all"
              v-text="file.fileName || file.url"
            />
          </li>
        </ul>
        <p
          v-else
          class="grow self-start text-sm text-muted"
          v-text="'—'"
        />
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()
const { loadClassMetadataIntoForm } = useNFTClassUpdater()

const { classId } = defineProps<{
  classId: string
}>()

const isLoading = ref(false)
const coverUrl = ref('')
const fileRows = ref<{ url: string, type: string, fileName: string }[]>([])

watch(() => classId, async () => {
  if (!classId) { return }
  try {
    isLoading.value = true
    const loaded = await loadClassMetadataIntoForm(classId)
    if (!loaded) { return }
    coverUrl.value = loaded.formData.coverUrl || ''
    fileRows.value = (loaded.formData.downloadableUrls || []).filter(file => file.url)
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load class metadata for the files tab:', error)
  }
  finally {
    isLoading.value = false
  }
}, { immediate: true })
</script>
