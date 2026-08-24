<template>
  <PageBody>
    <h1
      class="text-2xl font-bold"
      v-text="$t('preview_book.title')"
    />

    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
      class="mb-4"
    />

    <div class="flex gap-2 items-end">
      <UFormField
        :label="$t('preview_book.title')"
        class="flex-1"
      >
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

    <p
      v-if="detectedType"
      class="text-sm text-gray-500"
    >
      {{ $t('preview_book.detected_type') }}: {{ detectedType }}
    </p>
    <p
      v-else
      class="text-sm text-gray-500"
      v-text="$t('preview_book.supported_formats')"
    />

    <div
      v-if="fileBlob"
      class="flex"
    >
      <UButton
        :label="$t('preview_book.download')"
        variant="outline"
        icon="i-heroicons-arrow-down-tray"
        @click="triggerDownload"
      />
    </div>

    <UProgress
      v-if="isLoading"
      animation="carousel"
    />

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
      <canvas
        ref="pdfCanvasRef"
        class="shadow-lg"
      />
    </div>

    <div
      v-if="isBookLoaded || isPdfLoaded"
      class="flex justify-center gap-4 items-center"
    >
      <UButton
        :label="$t('preview_book.prev_page')"
        variant="outline"
        icon="i-heroicons-chevron-left"
        @click="prevPage"
      />
      <span
        v-if="isPdfLoaded"
        class="text-sm text-gray-500"
      >
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
import { getPdfDocument } from '~/utils/pdf'

type DetectedFileType = 'PNG' | 'JPEG' | 'GIF' | 'WebP' | 'BMP' | 'PDF' | 'EPUB' | null

const downloadMimeMap: Record<Exclude<DetectedFileType, null>, string> = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  WebP: 'image/webp',
  BMP: 'image/bmp',
  PDF: 'application/pdf',
  EPUB: 'application/epub+zip',
}
const downloadExtMap: Record<Exclude<DetectedFileType, null>, string> = {
  PNG: 'png',
  JPEG: 'jpg',
  GIF: 'gif',
  WebP: 'webp',
  BMP: 'bmp',
  PDF: 'pdf',
  EPUB: 'epub',
}

const { t: $t } = useI18n()
const route = useRoute()
const apiFetch = useLikeCoApiFetch()
const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public

// Read the raw query string so an unencoded inner URL (e.g. ?url=https://host/path?a=b&key=c)
// is not truncated at the first `&`, which is how route.query.url would parse it.
function getInitialInputUrl(): string {
  if (import.meta.client && window.location.search) {
    const match = window.location.search.match(/[?&]url=(.*)$/s)
    if (match?.[1]) {
      try { return decodeURIComponent(match[1]) }
      catch { return match[1] }
    }
  }
  return (route.query.url as string) || ''
}

const inputUrl = ref(getInitialInputUrl())
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

let rendition: { display: () => Promise<unknown>, prev: () => void, next: () => void, destroy: () => void } | null = null
let pdfDocument: PDFDocumentProxy | null = null

function detectFileType(buffer: ArrayBuffer): DetectedFileType {
  const bytes = new Uint8Array(buffer.slice(0, 12))
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) { return 'PNG' }
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) { return 'JPEG' }
  if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) { return 'GIF' }
  if (
    bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) { return 'WebP' }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4D) { return 'BMP' }
  // %PDF-
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D) { return 'PDF' }
  // EPUB is a ZIP archive (PK\x03\x04)
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) { return 'EPUB' }
  return null
}

async function renderPdfPage(pageNum: number) {
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
    viewport,
  }).promise
}

// The API's /arweave/v2/link response; `hasPublicCopy` is false when `link` is
// absent or serves ciphertext.
type LinkResponse = {
  arweaveId?: string
  key?: string
  link?: string
  txHash?: string
  hasPublicCopy?: boolean
  contentUri?: string
  contentType?: string
}

// Sentinels resolveUrl throws for the failures worth naming to the author;
// anything else falls through to the generic resolve error.
const RESOLVE_ERROR_I18N_KEYS = {
  missing_token: 'preview_book.error_missing_token',
  invalid_token: 'preview_book.error_invalid_token',
  unauthorized: 'preview_book.error_unauthorized',
} as const

async function resolveUrl(
  rawUrl: string,
): Promise<{ fileUrl: string, key?: string, requiresAuth: boolean }> {
  const apiEndpoints = getApiEndpoints()
  const arweaveLinkEndpoint = apiEndpoints.API_GET_ARWEAVE_V2_LINK

  if (rawUrl.startsWith(arweaveLinkEndpoint)) {
    const expectedOrigin = new URL(arweaveLinkEndpoint).origin
    const parsedRawUrl = new URL(rawUrl)
    if (parsedRawUrl.origin !== expectedOrigin) {
      throw new Error('URL origin does not match expected API endpoint')
    }
    let res: LinkResponse
    try {
      // Absolute URL bypasses the wrapper's baseURL but still gets the auth header
      res = await apiFetch<LinkResponse>(rawUrl, {
        headers: {
          Accept: 'application/json',
        },
      })
    }
    catch (err) {
      if (err instanceof FetchError) {
        // A protected book answers 401 to anyone not signed in as its owner,
        // which is the ordinary case here rather than a malformed URL.
        if (err.response?.status === 401) { throw new Error('unauthorized') }
        if (err.response?.status === 403) {
          const token = parsedRawUrl.searchParams.get('token')?.trim()
          throw new Error(token ? 'invalid_token' : 'missing_token')
        }
      }
      throw err
    }
    // hasPublicCopy, not `link`, decides: an encrypted doc whose key no longer
    // resolves still has a link, but it serves ciphertext. Protected books
    // (ADR 0001 Phase 3) have neither, only a gs:// contentUri no browser can
    // fetch, so both go through the owner-authed content route instead.
    if (!res.hasPublicCopy && res.contentUri && res.txHash) {
      const contentUrl = new URL(`${apiEndpoints.API_GET_ARWEAVE_V2_CONTENT}/${res.txHash}`)
      const token = parsedRawUrl.searchParams.get('token')
      if (token) { contentUrl.searchParams.set('token', token) }
      return { fileUrl: contentUrl.toString(), requiresAuth: true }
    }
    const arweaveId = (res.arweaveId || '').trim()
    const link = (res.link || '').trim()
    if (!link && !arweaveId) {
      throw new Error('Unable to resolve file URL from API response.')
    }
    const fileUrl = link || `${ARWEAVE_ENDPOINT}/${arweaveId}`
    return { fileUrl, key: res.key, requiresAuth: false }
  }

  if (rawUrl.startsWith('ar://')) {
    const urlWithoutProtocol = rawUrl.slice(5)
    const [arweaveId, queryString] = urlWithoutProtocol.split('?')
    const params = new URLSearchParams(queryString || '')
    const key = params.get('key')?.replace(/ /g, '+') || undefined
    return { fileUrl: `${ARWEAVE_ENDPOINT}/${arweaveId}`, key, requiresAuth: false }
  }

  if (rawUrl.startsWith('ipfs://')) {
    const urlWithoutProtocol = rawUrl.slice(7)
    const [cid, queryString] = urlWithoutProtocol.split('?')
    const params = new URLSearchParams(queryString || '')
    const key = params.get('key')?.replace(/ /g, '+') || undefined
    return { fileUrl: `https://w3s.link/ipfs/${cid}`, key, requiresAuth: false }
  }

  try {
    const parsed = new URL(rawUrl)
    const key = parsed.searchParams.get('key')?.replace(/ /g, '+') || undefined
    if (key) {
      parsed.searchParams.delete('key')
      return { fileUrl: parsed.toString(), key, requiresAuth: false }
    }
    return { fileUrl: rawUrl, requiresAuth: false }
  }
  catch {
    return { fileUrl: rawUrl, requiresAuth: false }
  }
}

async function loadBook() {
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
    let resolved: Awaited<ReturnType<typeof resolveUrl>>

    try {
      resolved = await resolveUrl(inputUrl.value)
    }
    catch (err) {
      const sentinel = err instanceof Error ? err.message : ''
      errorMessage.value = $t(
        RESOLVE_ERROR_I18N_KEYS[sentinel as keyof typeof RESOLVE_ERROR_I18N_KEYS]
        || 'preview_book.error_resolve',
      )
      return
    }
    const { fileUrl, key } = resolved

    let arrayBuffer: ArrayBuffer
    try {
      // apiFetch attaches the bearer token to absolute URLs too, so it is only safe
      // for our own content route — using it for ar:// or ipfs:// targets would ship
      // the author's JWT to arweave.net or w3s.link.
      const fetchFile = resolved.requiresAuth ? apiFetch : $fetch
      arrayBuffer = await fetchFile<ArrayBuffer>(fileUrl, { responseType: 'arrayBuffer' })
    }
    catch {
      errorMessage.value = $t('preview_book.error_fetch')
      return
    }

    if (key) {
      try {
        arrayBuffer = await decryptDataWithAES({ data: arrayBuffer, key })
      }
      catch {
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
          pdfDocument = await getPdfDocument(arrayBuffer)
          pdfTotalPages.value = pdfDocument.numPages
          pdfCurrentPage.value = 1
          isPdfLoaded.value = true
          await nextTick()
          await renderPdfPage(1)
        }
        catch {
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
        }
        catch {
          errorMessage.value = $t('preview_book.error_render')
        }
        break

      default:
        errorMessage.value = $t('preview_book.error_unsupported_format')
        break
    }
  }
  finally {
    isLoading.value = false
  }
}

function prevPage() {
  if (isPdfLoaded.value && pdfCurrentPage.value > 1) {
    pdfCurrentPage.value--
    renderPdfPage(pdfCurrentPage.value)
    return
  }
  rendition?.prev()
}

function nextPage() {
  if (isPdfLoaded.value && pdfCurrentPage.value < pdfTotalPages.value) {
    pdfCurrentPage.value++
    renderPdfPage(pdfCurrentPage.value)
    return
  }
  rendition?.next()
}

async function triggerDownload() {
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
