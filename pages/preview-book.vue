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

    <div v-if="fileBlob" class="flex">
      <UButton
        :label="$t('preview_book.download')"
        variant="outline"
        icon="i-heroicons-arrow-down-tray"
        @click="triggerDownload"
      />
    </div>

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

    <div
      v-if="isPdfLoaded"
      class="w-full border rounded-lg overflow-auto bg-gray-100 flex justify-center"
      style="height: 70vh"
    >
      <canvas ref="pdfCanvasRef" class="shadow-lg" />
    </div>

    <div v-if="isBookLoaded || isPdfLoaded" class="flex justify-center gap-4 items-center">
      <UButton
        :label="$t('preview_book.prev_page')"
        variant="outline"
        icon="i-heroicons-chevron-left"
        @click="prevPage"
      />
      <span v-if="isPdfLoaded" class="text-sm text-gray-500">
        {{ pdfCurrentPage }} / {{ pdfTotalPages }}
      </span>
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
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { FetchError } from 'ofetch'
import { useObjectUrl } from '@vueuse/core'
import { getApiEndpoints } from '~/constant/api'
import { decryptDataWithAES } from '~/utils/encryption'

type DetectedFileType = 'PNG' | 'JPEG' | 'GIF' | 'WebP' | 'BMP' | 'PDF' | 'EPUB' | null

const downloadMimeMap: Record<Exclude<DetectedFileType, null>, string> = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  WebP: 'image/webp',
  BMP: 'image/bmp',
  PDF: 'application/pdf',
  EPUB: 'application/epub+zip'
}
const downloadExtMap: Record<Exclude<DetectedFileType, null>, string> = {
  PNG: 'png',
  JPEG: 'jpg',
  GIF: 'gif',
  WebP: 'webp',
  BMP: 'bmp',
  PDF: 'pdf',
  EPUB: 'epub'
}

const { t: $t } = useI18n()
const route = useRoute()
const bookstoreApiStore = useBookstoreApiStore()
const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public

const inputUrl = ref((route.query.url as string) || '')
const isLoading = ref(false)
const isBookLoaded = ref(false)
const errorMessage = ref('')
const detectedType = ref('')
const viewerRef = ref<HTMLElement | null>(null)
const pdfCanvasRef = ref<HTMLCanvasElement | null>(null)
const isPdfLoaded = ref(false)
const pdfCurrentPage = ref(1)
const pdfTotalPages = ref(0)
const imageBlob = shallowRef<Blob | null>(null)
const fileBlob = shallowRef<Blob | null>(null)
const imageObjectUrl = useObjectUrl(imageBlob)
const downloadFilename = ref('')

let rendition: { display: () => Promise<unknown>; prev: () => void; next: () => void; destroy: () => void } | null = null
let pdfDocument: PDFDocumentProxy | null = null
let pdfjsLib: typeof import('pdfjs-dist') | null = null

function detectFileType (buffer: ArrayBuffer): DetectedFileType {
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
  // %PDF-
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D) { return 'PDF' }
  // EPUB is a ZIP archive (PK\x03\x04)
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) { return 'EPUB' }
  return null
}

async function loadPdfJs () {
  if (pdfjsLib) { return pdfjsLib }
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
  pdfjsLib = pdfjs
  return pdfjs
}

async function renderPdfPage (pageNum: number) {
  if (!pdfDocument || !pdfCanvasRef.value) { return }
  const page = await pdfDocument.getPage(pageNum)
  const scale = 1.5
  const viewport = page.getViewport({ scale })
  const canvas = pdfCanvasRef.value
  const pixelRatio = window.devicePixelRatio || 1
  canvas.height = viewport.height * pixelRatio
  canvas.width = viewport.width * pixelRatio
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  await page.render({
    canvas,
    transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : undefined,
    viewport
  }).promise
}

async function resolveUrl (rawUrl: string): Promise<{ fileUrl: string; key?: string }> {
  const apiEndpoints = getApiEndpoints()
  const arweaveLinkEndpoint = apiEndpoints.API_GET_ARWEAVE_V2_LINK

  if (rawUrl.startsWith(arweaveLinkEndpoint)) {
    const expectedOrigin = new URL(arweaveLinkEndpoint).origin
    const parsedRawUrl = new URL(rawUrl)
    if (parsedRawUrl.origin !== expectedOrigin) {
      throw new Error('URL origin does not match expected API endpoint')
    }
    let res: { arweaveId?: string; key?: string; link?: string }
    try {
      res = await $fetch<{ arweaveId?: string; key?: string; link?: string }>(rawUrl, {
        headers: {
          authorization: `Bearer ${bookstoreApiStore.token}`,
          Accept: 'application/json'
        }
      })
    } catch (err) {
      if (err instanceof FetchError && err.response?.status === 403) {
        const token = parsedRawUrl.searchParams.get('token')?.trim()
        throw new Error(token ? 'invalid_token' : 'missing_token')
      }
      throw err
    }
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

  imageBlob.value = null
  fileBlob.value = null
  downloadFilename.value = ''

  if (rendition) {
    rendition.destroy()
    rendition = null
  }

  if (pdfDocument) {
    pdfDocument.destroy()
    pdfDocument = null
    isPdfLoaded.value = false
  }

  try {
    let fileUrl: string
    let key: string | undefined

    try {
      const resolved = await resolveUrl(inputUrl.value)
      fileUrl = resolved.fileUrl
      key = resolved.key
    } catch (err) {
      if (err instanceof Error && err.message === 'missing_token') {
        errorMessage.value = $t('preview_book.error_missing_token')
      } else if (err instanceof Error && err.message === 'invalid_token') {
        errorMessage.value = $t('preview_book.error_invalid_token')
      } else {
        errorMessage.value = $t('preview_book.error_resolve')
      }
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

    const fileType = detectFileType(arrayBuffer)
    detectedType.value = fileType || ''

    if (fileType) {
      const blob = new Blob([arrayBuffer], { type: downloadMimeMap[fileType] })
      fileBlob.value = blob
      downloadFilename.value = `book.${downloadExtMap[fileType]}`
    }

    switch (fileType) {
      case 'PNG':
      case 'JPEG':
      case 'GIF':
      case 'WebP':
      case 'BMP':
        imageBlob.value = fileBlob.value
        break

      case 'PDF':
        try {
          const pdfjs = await loadPdfJs()
          const loadingTask = pdfjs.getDocument({
            data: arrayBuffer,
            wasmUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/wasm/`,
            cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
            cMapPacked: true
          })
          pdfDocument = await loadingTask.promise
          pdfTotalPages.value = pdfDocument.numPages
          pdfCurrentPage.value = 1
          isPdfLoaded.value = true
          await nextTick()
          await renderPdfPage(1)
        } catch {
          errorMessage.value = $t('preview_book.error_render_pdf')
        }
        break

      case 'EPUB':
        try {
          const { default: ePub } = await import('@likecoin/epub-ts')
          const book = ePub(arrayBuffer)
          rendition = book.renderTo(viewerRef.value!, { width: '100%', height: '100%' })
          await rendition!.display()
          isBookLoaded.value = true
        } catch {
          errorMessage.value = $t('preview_book.error_render')
        }
        break

      default:
        errorMessage.value = $t('preview_book.error_unsupported_format')
        break
    }
  } finally {
    isLoading.value = false
  }
}

function prevPage () {
  if (isPdfLoaded.value && pdfCurrentPage.value > 1) {
    pdfCurrentPage.value--
    renderPdfPage(pdfCurrentPage.value)
    return
  }
  rendition?.prev()
}

function nextPage () {
  if (isPdfLoaded.value && pdfCurrentPage.value < pdfTotalPages.value) {
    pdfCurrentPage.value++
    renderPdfPage(pdfCurrentPage.value)
    return
  }
  rendition?.next()
}

async function triggerDownload () {
  if (!fileBlob.value) { return }
  const { saveAs } = await import('file-saver')
  saveAs(fileBlob.value, downloadFilename.value || 'book')
}

onBeforeUnmount(() => {
  if (rendition) {
    rendition.destroy()
    rendition = null
  }
  if (pdfDocument) {
    pdfDocument.destroy()
    pdfDocument = null
  }
})

onMounted(() => {
  if (inputUrl.value) {
    loadBook()
  }
})
</script>
