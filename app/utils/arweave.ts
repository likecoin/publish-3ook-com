import { getApiEndpoints } from '~/constant/api'
import { EBOOK_FILE_TYPES, OPEN_IMAGE_FILE_TYPES } from '~/constant'
import type { ArweaveEstimate } from '~/types'
import { uploadToIrys } from '~/utils/irys'

export type UploadTier = 'protected' | 'open'

/**
 * Which storage tier a record belongs in, or null when its type has no GCS tier.
 *
 * Ebooks follow the book's DRM setting. Everything else — covers — is public by
 * nature and takes the open tier whatever that setting is: a cover has to render
 * to anyone browsing the store, so encrypting it or gating it buys nothing.
 */
function getUploadTier(
  fileType: string | undefined,
  encryptEbook: boolean,
): UploadTier | null {
  const type = fileType ?? ''
  if (EBOOK_FILE_TYPES.includes(type)) { return encryptEbook ? 'protected' : 'open' }
  return OPEN_IMAGE_FILE_TYPES.includes(type) ? 'open' : null
}

/**
 * The record's tier when that tier's GCS flag is on, else null for "upload
 * straight to Arweave from the browser". Client-only flows, so reading runtime
 * config here is safe.
 *
 * One accessor for a three-valued fact, so callers cannot hold a stale boolean
 * pair. Only 'protected' skips Arweave and its fee — an open record still pays,
 * because its Arweave copy is made server-side but it is made.
 */
export function getEnabledUploadTier(
  fileType: string | undefined,
  encryptEbook: boolean,
): UploadTier | null {
  const tier = getUploadTier(fileType, encryptEbook)
  if (!tier) { return null }
  const { IS_GCS_DIRECT_UPLOAD_ENABLED, IS_GCS_OPEN_UPLOAD_ENABLED } = useRuntimeConfig().public
  const isEnabled = tier === 'protected' ? IS_GCS_DIRECT_UPLOAD_ENABLED : IS_GCS_OPEN_UPLOAD_ENABLED
  return isEnabled ? tier : null
}

// A record with an upload result: Arweave results always carry arweaveId;
// GCS-direct results only ever carry the API link.
export function isRecordUploaded(record: { arweaveId?: string, arweaveLink?: string }): boolean {
  return !!(record.arweaveId || record.arweaveLink)
}

export function canSponsorArweaveUpload(
  estimate: Pick<ArweaveEstimate, 'remainingBytes' | 'remainingUploads' | 'isUnlimited'>,
  totalSize: number,
  fileCount: number,
): boolean {
  if (estimate.isUnlimited) { return true }
  return estimate.remainingBytes !== undefined
    && estimate.remainingUploads !== undefined
    && estimate.remainingBytes >= totalSize
    && estimate.remainingUploads >= fileCount
}

export async function estimateBundlrFilePrice({
  fileSize,
  ipfsHash,
  token,
}: {
  fileSize: number
  ipfsHash?: string
  token?: string
}): Promise<ArweaveEstimate> {
  const apiEndpoints = getApiEndpoints()
  const data = await $fetch<ArweaveEstimate>(apiEndpoints.API_POST_ARWEAVE_V2_ESTIMATE, {
    method: 'POST',
    body: {
      fileSize,
      ipfsHash,
    },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return data
}

export async function uploadSingleFileToBundlr(
  file: Buffer,
  {
    fileType,
    fileSize,
    ipfsHash,
    txHash,
    token,
    key,
    sponsored,
    fileSHA256,
  }: {
    fileSize: number
    fileType?: string
    ipfsHash: string
    txHash?: string
    token: string
    key?: string
    sponsored?: boolean
    fileSHA256?: string
  },
) {
  const tags = [
    { name: 'App-Name', value: 'publish.3ook.com' },
    { name: 'App-Version', value: '2.0' },
    { name: 'User-Agent', value: 'publish.3ook.com' },
    { name: 'IPFS-CID', value: ipfsHash },
  ]
  if (fileType) { tags.push({ name: 'Content-Type', value: fileType }) }
  if (key) { tags.push({ name: 'Content-Encoding', value: 'aes256gcm' }) }

  const { id: arweaveId, uploadId, signToken } = await uploadToIrys(file, {
    tags,
    fileSize,
    ipfsHash,
    txHash,
    token,
    sponsored,
  })

  const registrationId = sponsored ? (uploadId || txHash) : (txHash || uploadId)
  if (!registrationId) {
    throw new Error('Missing registration ID: neither uploadId nor txHash is available')
  }

  const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public
  let arweaveLink = `${ARWEAVE_ENDPOINT}/${arweaveId}`

  if (arweaveId) {
    const apiEndpoints = getApiEndpoints()
    const data = await $fetch(apiEndpoints.API_POST_ARWEAVE_V2_REGISTER, {
      method: 'POST',
      body: {
        fileSize,
        ipfsHash,
        txHash: registrationId,
        arweaveId,
        token: signToken,
        key,
        fileSHA256,
      },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const result = data as { link?: string }
    if (result?.link) {
      arweaveLink = result.link
    }
  }

  return {
    arweaveId,
    arweaveLink,
    arweaveKey: key,
  }
}

export interface GcsStageParams {
  fileType: string
  fileName?: string
  fileSHA256: string
  token: string
}

// Stage bytes in the tier's GCS bucket via a short-TTL signed resumable URL, and
// return the upload id. Shared by both tiers: init → resumable session → PUT.
// What happens next differs, so this deliberately stops before any finalize step.
async function stageFileInGcs(
  file: Blob,
  {
    fileType, fileName, fileSHA256, token, tier,
  }: GcsStageParams & { tier: UploadTier },
): Promise<string> {
  const apiEndpoints = getApiEndpoints()
  const { id, uploadUrl } = await $fetch<{ id: string, uploadUrl: string }>(
    apiEndpoints.API_POST_ARWEAVE_V2_GCS_UPLOAD_INIT,
    {
      method: 'POST',
      body: {
        fileSize: file.size,
        fileSHA256,
        contentType: fileType,
        fileName,
        tier,
      },
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  // The signed URL only authorizes starting the session; GCS answers with the
  // session URI in Location (bucket CORS must expose that header).
  const sessionRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': fileType, 'x-goog-resumable': 'start' },
  })
  if (!sessionRes.ok) {
    throw new Error(`Failed to start GCS upload session (${sessionRes.status})`)
  }
  const sessionUri = sessionRes.headers.get('location')
  if (!sessionUri) {
    throw new Error('GCS upload session URI missing; check bucket CORS exposes Location')
  }
  const putRes = await fetch(sessionUri, { method: 'PUT', body: file })
  if (!putRes.ok) {
    throw new Error(`Failed to upload file to GCS (${putRes.status})`)
  }
  return id
}

// GCS-direct upload for DRM ebooks (ADR 0001 Phase 3): plaintext goes straight
// to the private bucket — no Arweave, no fee, no client AES.
export async function uploadEbookToGcsDirect(
  file: Blob,
  { fileType, fileName, fileSHA256, token }: GcsStageParams,
): Promise<{ id: string, link: string }> {
  const apiEndpoints = getApiEndpoints()
  const id = await stageFileInGcs(file, {
    fileType, fileName, fileSHA256, token, tier: 'protected',
  })
  const { link } = await $fetch<{ id: string, link: string }>(
    `${apiEndpoints.API_POST_ARWEAVE_V2_GCS_FINALIZE}/${id}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  return { id, link }
}

/**
 * GCS-first upload for DRM-free ebooks (ADR 0001 Phase 3 amendment).
 *
 * The browser uploads once, to GCS; the server reads those bytes back, signs the
 * ANS-104 DataItem, uploads to Irys and blocks on the node's receipt before
 * returning the arweaveId — so the client needs no signer, public key or ANS-104
 * implementation. The fee is unchanged: pay on Base and pass the payment tx here,
 * or use the sponsored quota.
 */
export async function uploadFileToGcsOpen(
  file: Blob,
  {
    fileType, fileName, fileSHA256, token, ipfsHash, paymentTxHash, sponsored,
  }: GcsStageParams & {
    ipfsHash: string
    paymentTxHash?: string
    sponsored?: boolean
  },
): Promise<{ id: string, arweaveId: string, link: string }> {
  const apiEndpoints = getApiEndpoints()
  const id = await stageFileInGcs(file, {
    fileType, fileName, fileSHA256, token, tier: 'open',
  })
  const { arweaveId, link } = await $fetch<{ id: string, arweaveId: string, link: string }>(
    `${apiEndpoints.API_POST_ARWEAVE_V2_GCS_ARWEAVE}/${id}`,
    {
      method: 'POST',
      body: {
        ipfsHash,
        paymentTxHash,
        txToken: sponsored ? 'SPONSORED' : 'BASEETH',
      },
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  if (!arweaveId) {
    throw new Error('Server did not return an Arweave ID for the DRM-free upload')
  }
  return { id, arweaveId, link }
}
