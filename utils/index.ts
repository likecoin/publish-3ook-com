import { stringify as csvStringify } from 'csv-stringify/sync'
import { useClipboard } from '@vueuse/core'
import { importer } from 'ipfs-unixfs-importer'
import { keccak256, toBytes } from 'viem'

const ACCOUNT_ID_CHARS = 'abcdefghjkmnpqrstuvwxyz' as const
const ACCOUNT_ID_LENGTH = 6

export function getIsTestnet () {
  const { IS_TESTNET } = useRuntimeConfig().public
  return IS_TESTNET === 'TRUE'
}

export function addParamToUrl (url: string, params: { [key: string]: string }) {
  const urlObject = new URL(url)
  const urlParams = new URLSearchParams(urlObject.search)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      urlParams.set(key, value)
    }
  })
  urlObject.search = urlParams.toString()
  return urlObject.toString()
}

export function downloadBlob (content: string, filename: string, contentType: string) {
  // Create a blob
  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)

  // Create a link to download it
  const pom = document.createElement('a')
  pom.href = url
  pom.setAttribute('download', filename)
  pom.click()
}

/**
 * Download array of objects as CSV with BOM for Excel compatibility with Chinese characters
 * @param data - Array of objects to export
 * @param columns - Column definitions with key and display label
 * @param filename - Output filename
 */
export async function downloadCSV (
  data: Record<string, any>[],
  columns: { key: string; label: string }[],
  filename: string
) {
  if (data.length === 0) {
    return
  }

  const { saveAs } = await import('file-saver')

  // Map data to columns and use csv-stringify for proper escaping
  const rows = data.map(row =>
    columns.map(col => row[col.key] ?? '')
  )

  const csvContent = csvStringify(rows, {
    header: true,
    columns: columns.map(col => col.label)
  })

  // Add BOM for Excel compatibility with Chinese characters
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, filename)
}

export function parseImageURLFromMetadata (image: string): string {
  const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public
  if (!image) { return '' }
  return image.replace('ar://', `${ARWEAVE_ENDPOINT}/`).replace('ipfs://', 'https://ipfs.io/ipfs/')
}

export function downloadFile ({ data, fileName, fileType }:{data:any, fileName:string, fileType:string}) {
  let fileData
  let mimeType
  if (fileType === 'json') {
    fileData = JSON.stringify(data, null, 2)
    mimeType = 'application/json'
  } else if (fileType === 'csv') {
    fileData = convertArrayOfObjectsToCSV(data)
    mimeType = 'text/csv'
  } else {
    throw new Error('Unsupported file type')
  }

  const fileBlob = new Blob([fileData], { type: mimeType })
  const fileUrl = URL.createObjectURL(fileBlob)
  const fileLink = document.createElement('a')
  fileLink.href = fileUrl
  fileLink.download = fileName
  fileLink.style.display = 'none'

  document.body.appendChild(fileLink)
  fileLink.click()
  document.body.removeChild(fileLink)
}

export function sleep (time: number) {
  return new Promise((resolve) => { setTimeout(resolve, time) })
}

export function convertArrayOfObjectsToCSV (data: Record<string, any>[]): string {
  if (data.length === 0) {
    return ''
  }
  return csvStringify(data, { header: true })
}

export function getPortfolioURL (wallet = '') {
  const { OPENSEA_URL } = useRuntimeConfig().public
  return `${OPENSEA_URL}/${wallet}`
}

export const deliverMethodOptions = [
  {
    value: 'auto',
    label: 'Auto delivery / 自動發書'
  },
  {
    value: 'manual',
    label: 'Manual delivery / 手動發書'
  }
]

export function getPurchaseLink ({
  classId,
  priceIndex = 0,
  channel,
  customLink,
  isUseLikerLandLink,
  isForQRCode,
  query: queryInput
}:{
  classId?: string
  priceIndex?: number
  channel?: string
  customLink?: string
  isUseLikerLandLink?: boolean
  isForQRCode?: boolean
  query?: Record<string, string>
}) {
  const query: Record<string, string> = {
    from: channel || ''
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

export function formatCurrency (currency: string) {
  return currency?.toUpperCase() || ''
}

export function formatNumberWithCurrency (valueInDecimal: number, currency: string) {
  const value = convertDecimalToAmount(valueInDecimal, currency)
  const suffix = currency ? ` ${formatCurrency(currency)}` : ''
  return `${value.toLocaleString('en-US')}${suffix}`
}

export function convertDecimalToAmount (valueInDecimal: number, currency: string) {
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

export function validateChannelId (channelId: string) {
  return channelId.startsWith('@')
}

export function convertChannelIdToLikerId (channelId: string) {
  return channelId.replace(/^@/, '')
}

export function convertLikerIdToChannelId (likerId: string) {
  return `@${likerId}`
}

export function copyToClipboard (text: string): void {
  const toast = useToast()
  const { copy } = useClipboard()

  copy(text).then(() => {
    toast.add({
      icon: 'i-heroicons-clipboard',
      title: 'Copied to clipboard',
      timeout: 3000
    })
  }).catch(() => {
    toast.add({
      icon: 'i-heroicons-warning',
      title: 'Failed to copy',
      timeout: 3000
    })
  })
}

export function getImageResizeURL (url: string, { width = 300 }: { width?: number } = {}) {
  const { LIKE_CO_STATIC_ENDPOINT } = useRuntimeConfig().public
  return `${LIKE_CO_STATIC_ENDPOINT}/thumbnail/?url=${encodeURIComponent(url)}&width=${width}`
}

export function fileToArrayBuffer (file: Blob): Promise<ArrayBuffer> {
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

export function digestFileSHA256 (buffer: ArrayBuffer) {
  const hashHex = Buffer.from(buffer).toString('hex')
  return hashHex
}

export async function calculateIPFSHash (fileBytes: any, options?: any) {
  try {
    options = options || {}

    const block = {
      get: (cid: any) => { throw new Error(`unexpected block API get for ${cid}`) },
      put: (_: any) => { }
    }

    let lastCid
    for await (const { cid } of importer([{
      content: fileBytes
    }], block as any, {
      ...options,
      cidVersion: 0,
      rawLeaves: false,
      onlyHash: true
    })) {
      lastCid = cid
    }

    if (lastCid) {
      return lastCid.toString()
    }
    return null
  } catch (error) {
    console.error('Error calculating IPFS hash:', error)
    return null
  }
}

export function appendUTMParamsToURL ({
  url,
  source = 'publish-liker-land',
  medium = '',
  campaign = ''
}:{
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

export function verifyAccountId (id: string) {
  return !!id && (/^[a-z0-9-_]+$/.test(id) && id.length >= 5 && id.length <= 20)
}

export function verifyEmail (email: string) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function convertBigIntToBaseString (num: bigint, length: number) {
  let str = ''
  for (let i = 0; i < length; i++) {
    const base = BigInt(ACCOUNT_ID_CHARS.length)
    str = ACCOUNT_ID_CHARS[Number(num % base)] + str
    num = num / base
  }
  return str
}

export function generateAccountIdFromWalletAddress (walletAddress: string) {
  const hash = keccak256(toBytes(walletAddress.trim().toLowerCase()))
  // Add 2 to include '0x' prefix
  const hex = hash.slice(0, ACCOUNT_ID_LENGTH * 2 + 2)
  const num = BigInt(hex)
  return convertBigIntToBaseString(num, ACCOUNT_ID_LENGTH)
}

export function checkIsEVMAddress (address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}
