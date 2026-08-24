import { useClipboard } from '@vueuse/core'
import { importer, type WritableStorage } from 'ipfs-unixfs-importer'
import { keccak256, toBytes } from 'viem'

const ACCOUNT_ID_CHARS = 'abcdefghjkmnpqrstuvwxyz' as const
const ACCOUNT_ID_LENGTH = 6

export function getIsTestnet() {
  const { IS_TESTNET } = useRuntimeConfig().public
  return !!IS_TESTNET
}

export function parseImageURLFromMetadata(image: string): string {
  const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public
  if (!image) { return '' }
  return image.replace('ar://', `${ARWEAVE_ENDPOINT}/`).replace('ipfs://', 'https://ipfs.io/ipfs/')
}

export function sleep(time: number) {
  return new Promise((resolve) => { setTimeout(resolve, time) })
}

export function getPortfolioURL(wallet = '') {
  const { OPENSEA_URL } = useRuntimeConfig().public
  return `${OPENSEA_URL}/${wallet}`
}

export function getPurchaseLink({
  classId,
  priceIndex = 0,
  channel,
  customLink,
  isUseLikerLandLink,
  isForQRCode,
  query: queryInput,
}: {
  classId?: string
  priceIndex?: number
  channel?: string
  customLink?: string
  isUseLikerLandLink?: boolean
  isForQRCode?: boolean
  query?: Record<string, string>
}) {
  const query: Record<string, string> = {
    from: channel || '',
  }
  if (classId && !customLink) {
    query.price_index = priceIndex.toString()
  }
  if (isForQRCode) {
    query.utm_medium = queryInput?.utm_medium ? `${queryInput.utm_medium}-qr` : 'qrcode'
  }

  const { LIKE_CO_API, BOOK3_URL } = useRuntimeConfig().public
  const searchParams = new URLSearchParams({ ...queryInput, ...query })
  if (customLink) {
    const url = new URL(customLink)
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value)
    })
    return url.toString()
  }

  const queryString = `?${searchParams.toString()}`
  return isUseLikerLandLink
    ? `${BOOK3_URL}/store/${classId}${queryString}`
    : `${LIKE_CO_API}/likernft/book/purchase/${classId}/new${queryString}`
}

export function formatCurrency(currency: string) {
  return currency?.toUpperCase() || ''
}

export function convertMsToMinutes(ms: number) {
  return Math.round((ms / (1000 * 60)) * 10) / 10
}

export function formatNumberWithCurrency(valueInDecimal: number, currency: string) {
  const value = convertDecimalToAmount(valueInDecimal, currency)
  const suffix = currency ? ` ${formatCurrency(currency)}` : ''
  return `${value.toLocaleString('en-US')}${suffix}`
}

export function convertDecimalToAmount(valueInDecimal: number, currency: string) {
  let value = 0
  switch (currency) {
    case 'usdc':
      value = valueInDecimal / 1000000
      break
    case 'usd':
    default:
      value = valueInDecimal / 100
      break
  }
  return value
}

export function validateChannelId(channelId: string) {
  return channelId.startsWith('@')
}

export function convertChannelIdToLikerId(channelId: string) {
  return channelId.replace(/^@/, '')
}

export function convertLikerIdToChannelId(likerId: string) {
  return `@${likerId}`
}

export function copyToClipboard(text: string, title?: string): void {
  const toast = useToast()
  const { copy } = useClipboard()

  copy(text).then(() => {
    toast.add({
      icon: 'i-heroicons-check-circle',
      title: title || 'Copied to clipboard',
      duration: 2000,
      color: 'success',
    })
  }).catch(() => {
    toast.add({
      icon: 'i-heroicons-warning',
      title: 'Failed to copy',
      duration: 3000,
    })
  })
}

export function getImageResizeURL(url: string, { width = 300 }: { width?: number } = {}) {
  const { LIKE_CO_STATIC_ENDPOINT } = useRuntimeConfig().public
  return `${LIKE_CO_STATIC_ENDPOINT}/thumbnail/?url=${encodeURIComponent(url)}&width=${width}`
}

export function fileToArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result
      if (!result) {
        reject(new Error('Failed to read file: Empty result'))
        return
      }
      if (!(result instanceof ArrayBuffer)) {
        reject(new Error('Failed to read file: Expected ArrayBuffer'))
        return
      }
      resolve(result)
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file: ' + reader.error?.message))
    }

    reader.readAsArrayBuffer(file)
  })
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file: Expected a data URL'))
        return
      }
      resolve(result)
    }

    reader.onerror = () => {
      // Falls back because a truthy-but-useless "…: undefined" would beat the
      // callers' own generic message rather than letting it through.
      reject(new Error('Failed to read file: ' + (reader.error?.message || 'unknown error')))
    }

    reader.readAsDataURL(file)
  })
}

export async function digestFileSHA256(buffer: ArrayBuffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function calculateIPFSHash(fileBytes: Uint8Array | Buffer, options?: Record<string, unknown>) {
  try {
    options = options || {}

    const block = {
      put: async () => {},
    } as unknown as WritableStorage

    let lastCid
    for await (const { cid } of importer([{
      content: fileBytes,
    }], block, {
      ...options,
      cidVersion: 0,
      rawLeaves: false,
      onlyHash: true,
    } as Parameters<typeof importer>[2])) {
      lastCid = cid
    }

    if (lastCid) {
      return lastCid.toString()
    }
    return null
  }
  catch (error) {
    console.error('Error calculating IPFS hash:', error)
    return null
  }
}

export function appendUTMParamsToURL({
  url,
  source = 'publish-liker-land',
  medium = '',
  campaign = '',
}: {
  url: string
  source?: string
  medium?: string
  campaign?: string
}) {
  const urlObj = new URL(url)
  urlObj.searchParams.set('utm_source', source)
  urlObj.searchParams.set('utm_medium', medium)
  urlObj.searchParams.set('utm_campaign', campaign)
  return urlObj.toString()
}

export function verifyAccountId(id: string) {
  return !!id && (/^[a-z0-9-_]+$/.test(id) && id.length >= 5 && id.length <= 20)
}

export function verifyEmail(email: string) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function convertBigIntToBaseString(num: bigint, length: number) {
  let str = ''
  for (let i = 0; i < length; i++) {
    const base = BigInt(ACCOUNT_ID_CHARS.length)
    str = ACCOUNT_ID_CHARS[Number(num % base)] + str
    num = num / base
  }
  return str
}

export function generateAccountIdFromWalletAddress(walletAddress: string) {
  const hash = keccak256(toBytes(walletAddress.trim().toLowerCase()))
  // Add 2 to include '0x' prefix
  const hex = hash.slice(0, ACCOUNT_ID_LENGTH * 2 + 2)
  const num = BigInt(hex)
  return convertBigIntToBaseString(num, ACCOUNT_ID_LENGTH)
}

// The clock half of a 最後儲存 line. Shared so the wizard's draft bar and the
// book page's save bar cannot drift into two different time formats.
export function formatSavedAtTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) { return '0 B' }
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}
