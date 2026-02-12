<template>
  <PageBody>
    <h1 class="text-2xl font-bold" v-text="$t('preview_book.title')" />

    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
      class="mb-4"
    />

    <div class="flex gap-2 items-end">
      <UFormField :label="$t('preview_book.title')" class="flex-1">
        <UInput
          v-model="inputUrl"
          :placeholder="$t('preview_book.input_placeholder')"
          class="font-mono"
        />
      </UFormField>
      <UButton
        :label="$t('preview_book.load')"
        :loading="isLoading"
        :disabled="!inputUrl || isLoading"
        @click="loadBook"
      />
    </div>

    <p v-if="detectedType" class="text-sm text-gray-500">
      {{ $t('preview_book.detected_type') }}: {{ detectedType }}
    </p>
    <p v-else class="text-sm text-gray-500" v-text="$t('preview_book.supported_formats')" />

    <UProgress v-if="isLoading" animation="carousel" />

    <img
      v-if="imageObjectUrl"
      :src="imageObjectUrl"
      :alt="$t('preview_book.title')"
      class="max-w-full max-h-[70vh] border rounded-lg object-contain"
    >

    <div
      v-show="isLoading || isBookLoaded"
      ref="viewerRef"
      class="w-full border rounded-lg overflow-hidden"
      style="height: 70vh"
    />

    <div v-if="isBookLoaded" class="flex justify-center gap-4">
      <UButton
        :label="$t('preview_book.prev_page')"
        variant="outline"
        icon="i-heroicons-chevron-left"
        @click="prevPage"
      />
      <UButton
        :label="$t('preview_book.next_page')"
        variant="outline"
        trailing-icon="i-heroicons-chevron-right"
        @click="nextPage"
      />
    </div>
  </PageBody>
</template>

<script setup lang="ts">
import { getApiEndpoints } from '~/constant/api'
import { decryptDataWithAES } from '~/utils/encryption'

const { t: $t } = useI18n()
const route = useRoute()
const bookstoreApiStore = useBookstoreApiStore()
const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public

const inputUrl = ref((route.query.url as string) || '')
const isLoading = ref(false)
const isBookLoaded = ref(false)
const errorMessage = ref('')
const imageObjectUrl = ref('')
const detectedType = ref('')
const viewerRef = ref<HTMLElement | null>(null)

let rendition: { display: () => Promise<unknown>; prev: () => void; next: () => void; destroy: () => void } | null = null

function detectImageType (buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer.slice(0, 12))
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) { return 'PNG' }
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) { return 'JPEG' }
  if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) { return 'GIF' }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) { return 'WebP' }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4D) { return 'BMP' }
  return null
}

async function resolveUrl (rawUrl: string): Promise<{ fileUrl: string; key?: string }> {
  const apiEndpoints = getApiEndpoints()
  const arweaveLinkEndpoint = apiEndpoints.API_GET_ARWEAVE_V2_LINK

  if (rawUrl.startsWith(arweaveLinkEndpoint)) {
    const expectedOrigin = new URL(arweaveLinkEndpoint).origin
    const actualOrigin = new URL(rawUrl).origin
    if (actualOrigin !== expectedOrigin) {
      throw new Error('URL origin does not match expected API endpoint')
    }
    const res = await $fetch<{ arweaveId?: string; key?: string; link?: string }>(rawUrl, {
      headers: {
        authorization: `Bearer ${bookstoreApiStore.token}`,
        Accept: 'application/json'
      }
    })
    const arweaveId = (res.arweaveId || '').trim()
    const link = (res.link || '').trim()
    const key = res.key
    if (!link && !arweaveId) {
      throw new Error('Unable to resolve file URL from API response.')
    }
    const fileUrl = link || `${ARWEAVE_ENDPOINT}/${arweaveId}`
    return { fileUrl, key }
  }

  if (rawUrl.startsWith('ar://')) {
    const urlWithoutProtocol = rawUrl.slice(5)
    const [arweaveId, queryString] = urlWithoutProtocol.split('?')
    const params = new URLSearchParams(queryString || '')
    const key = params.get('key')?.replace(/ /g, '+') || undefined
    return { fileUrl: `${ARWEAVE_ENDPOINT}/${arweaveId}`, key }
  }

  if (rawUrl.startsWith('ipfs://')) {
    const urlWithoutProtocol = rawUrl.slice(7)
    const [cid, queryString] = urlWithoutProtocol.split('?')
    const params = new URLSearchParams(queryString || '')
    const key = params.get('key')?.replace(/ /g, '+') || undefined
    return { fileUrl: `https://w3s.link/ipfs/${cid}`, key }
  }

  try {
    const parsed = new URL(rawUrl)
    const key = parsed.searchParams.get('key')?.replace(/ /g, '+') || undefined
    if (key) {
      parsed.searchParams.delete('key')
      return { fileUrl: parsed.toString(), key }
    }
    return { fileUrl: rawUrl }
  } catch {
    return { fileUrl: rawUrl }
  }
}

async function loadBook () {
  errorMessage.value = ''
  detectedType.value = ''
  isLoading.value = true
  isBookLoaded.value = false

  if (imageObjectUrl.value) {
    URL.revokeObjectURL(imageObjectUrl.value)
    imageObjectUrl.value = ''
  }

  if (rendition) {
    rendition.destroy()
    rendition = null
  }

  try {
    let fileUrl: string
    let key: string | undefined

    try {
      const resolved = await resolveUrl(inputUrl.value)
      fileUrl = resolved.fileUrl
      key = resolved.key
    } catch {
      errorMessage.value = $t('preview_book.error_resolve')
      return
    }

    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await $fetch<ArrayBuffer>(fileUrl, { responseType: 'arrayBuffer' })
    } catch {
      errorMessage.value = $t('preview_book.error_fetch')
      return
    }

    if (key) {
      try {
        arrayBuffer = await decryptDataWithAES({ data: arrayBuffer, key })
      } catch {
        errorMessage.value = $t('preview_book.error_decrypt')
        return
      }
    }

    const imageType = detectImageType(arrayBuffer)
    if (imageType) {
      detectedType.value = imageType
      const blob = new Blob([arrayBuffer])
      imageObjectUrl.value = URL.createObjectURL(blob)
      return
    }

    try {
      const { default: ePub } = await import('@likecoin/epub-ts')
      const book = ePub(arrayBuffer)
      rendition = book.renderTo(viewerRef.value!, { width: '100%', height: '100%' })
      await rendition!.display()
      isBookLoaded.value = true
      detectedType.value = 'EPUB'
    } catch {
      errorMessage.value = $t('preview_book.error_render')
    }
  } finally {
    isLoading.value = false
  }
}

function prevPage () {
  rendition?.prev()
}

function nextPage () {
  rendition?.next()
}

onBeforeUnmount(() => {
  if (rendition) {
    rendition.destroy()
    rendition = null
  }
  if (imageObjectUrl.value) {
    URL.revokeObjectURL(imageObjectUrl.value)
  }
})

onMounted(() => {
  if (inputUrl.value) {
    loadBook()
  }
})
</script>
