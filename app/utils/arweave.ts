import { getApiEndpoints } from '~/constant/api'
import { EBOOK_FILE_TYPES } from '~/constant'
import type { ArweaveEstimate } from '~/types'
import { uploadToIrys } from '~/utils/irys'

// True when this record bypasses Arweave for the private GCS bucket
// (ADR 0001 Phase 3): DRM ebooks only, behind the env flag. Client-only
// flows, so reading runtime config here is safe.
export function shouldUploadViaGcs(fileType: string | undefined, encryptEbook: boolean): boolean {
  const { IS_GCS_DIRECT_UPLOAD_ENABLED } = useRuntimeConfig().public
  return !!IS_GCS_DIRECT_UPLOAD_ENABLED
    && encryptEbook
    && EBOOK_FILE_TYPES.includes(fileType ?? '')
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

// GCS-direct upload for DRM ebooks (ADR 0001 Phase 3): plaintext goes straight
// to the private bucket via a short-TTL signed resumable URL — no Arweave, no
// fee, no client AES. init → resumable session → PUT bytes → finalize.
export async function uploadEbookToGcsDirect(
  file: Blob,
  {
    fileType,
    fileName,
    fileSHA256,
    token,
  }: {
    fileType: string
    fileName?: string
    fileSHA256: string
    token: string
  },
): Promise<{ id: string, link: string }> {
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
  const { link } = await $fetch<{ id: string, link: string }>(
    `${apiEndpoints.API_POST_ARWEAVE_V2_GCS_FINALIZE}/${id}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  return { id, link }
}
