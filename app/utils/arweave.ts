import { getApiEndpoints } from '~/constant/api'
import { EBOOK_FILE_TYPES, OPEN_IMAGE_FILE_TYPES, GENERATED_COVER_SUFFIX } from '~/constant'
import type { ArweaveEstimate } from '~/types'

export type UploadTier = 'protected' | 'open'

/**
 * Which storage tier a record belongs in, or null when its type has no tier.
 *
 * Ebooks follow the book's DRM setting. Everything else — covers — is public by
 * nature and takes the open tier whatever that setting is: a cover has to render
 * to anyone browsing the store, so encrypting it or gating it buys nothing.
 *
 * Null has no upload path at all, so callers must reject those types at
 * selection time (UPLOADABLE_FILE_TYPES) rather than discover it here.
 */
export function getUploadTier(
  fileType: string | undefined,
  encryptEbook: boolean,
): UploadTier | null {
  const type = fileType ?? ''
  if (EBOOK_FILE_TYPES.includes(type)) { return encryptEbook ? 'protected' : 'open' }
  return OPEN_IMAGE_FILE_TYPES.includes(type) ? 'open' : null
}

/**
 * The cover an EPUB carried, as opposed to one the author picked.
 *
 * The flag is the truth and is persisted with the draft; the name suffix is
 * only a fallback for drafts written before the flag existed. Inferring from
 * the name alone was wrong: an author whose own file happened to end in
 * `_cover.jpeg` had it treated as generated, so the cover shown in the preview
 * was not the one that got published.
 */
export function isGeneratedCoverRecord(
  record: { fileName?: string, isGeneratedCover?: boolean },
): boolean {
  return record.isGeneratedCover ?? !!record.fileName?.endsWith(GENERATED_COVER_SUFFIX)
}

// Any image in a book's file list is its cover: nothing else uploads one.
export function isCoverRecord(record: { fileType?: string }): boolean {
  return !!record.fileType?.startsWith('image/')
}

// The author's own cover choice. Both kinds coexist after a replacement, and
// only this one may be pruned — the generated one is what 復原 reverts to.
export function isManualCoverRecord(
  record: { fileName?: string, fileType?: string, isGeneratedCover?: boolean },
): boolean {
  return isCoverRecord(record) && !isGeneratedCoverRecord(record)
}

// A record with an upload result: Arweave results always carry arweaveId;
// GCS-direct results only ever carry the API link.
export function isRecordUploaded(record: { arweaveId?: string, arweaveLink?: string }): boolean {
  return !!(record.arweaveId || record.arweaveLink)
}

/**
 * Drops the public Arweave result from a record that now belongs in the
 * protected tier, so isRecordUploaded() stops reporting it as uploaded.
 *
 * arweaveLink goes with the id: it is written alongside every open-tier id, so
 * clearing the id alone would still skip the upload and leave a protected book
 * resolving to its public copy. A GCS-protected record carries a link and no
 * id, so the id guard leaves it untouched.
 *
 * ipfsHash stays — only the open path reads it, and keeping it saves re-hashing
 * a 200MB file if the author toggles back.
 */
export function clearOpenTierResult(record: { arweaveId?: string, arweaveLink?: string }): void {
  if (!record.arweaveId) { return }
  record.arweaveId = undefined
  record.arweaveLink = undefined
}

/**
 * Applies that invariant across a whole selection.
 *
 * Must run before anything decides an upload is unnecessary: both the uploader
 * and the publish pipeline short-circuit on isRecordUploaded(), which a stale
 * open-tier id keeps true. The tier can change long after the files were
 * chosen — the wizard asks at its pricing step, and a failed publish can be
 * retried with a different answer.
 */
export function clearStaleOpenTierResults(
  records: { fileType?: string, arweaveId?: string, arweaveLink?: string }[],
  encryptEbook: boolean,
): void {
  records.forEach((record) => {
    if (getUploadTier(record.fileType, encryptEbook) === 'protected') {
      clearOpenTierResult(record)
    }
  })
}

// Blobs never survive a reload, so a restored record is only publishable if its
// upload already landed. Checking arweaveId alone would strand protected-tier
// files, which carry a link and no id.
export function needsFileReselect(
  record: { fileBlob?: Blob, arweaveId?: string, arweaveLink?: string },
): boolean {
  return !record.fileBlob && !isRecordUploaded(record)
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
 * GCS-first upload for DRM-free ebooks and covers (ADR 0001 Phase 3 amendment).
 *
 * The browser uploads once, to GCS; the server reads those bytes back, signs the
 * ANS-104 DataItem, uploads to Irys and blocks on the node's receipt before
 * returning the arweaveId — so the client needs no signer, public key or ANS-104
 * implementation.
 *
 * Always sponsored: the Arweave fee is settled against the publisher's daily
 * quota, never an on-chain payment. A batch the quota cannot cover fails at
 * upload_init, which is why callers check the quota before starting.
 */
export async function uploadFileToGcsOpen(
  file: Blob,
  {
    fileType, fileName, fileSHA256, token, ipfsHash,
  }: GcsStageParams & { ipfsHash: string },
): Promise<{ id: string, arweaveId: string, link: string }> {
  const apiEndpoints = getApiEndpoints()
  const id = await stageFileInGcs(file, {
    fileType, fileName, fileSHA256, token, tier: 'open',
  })
  const { arweaveId, link } = await $fetch<{ id: string, arweaveId: string, link: string }>(
    `${apiEndpoints.API_POST_ARWEAVE_V2_GCS_ARWEAVE}/${id}`,
    {
      method: 'POST',
      body: { ipfsHash, txToken: 'SPONSORED' },
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  if (!arweaveId) {
    throw new Error('Server did not return an Arweave ID for the DRM-free upload')
  }
  return { id, arweaveId, link }
}
