/**
 * Lightweight ANS-104 DataItem builder and Irys uploader.
 * Replaces @irys/sdk + arbundles with ~150 lines of pure WebCrypto code.
 *
 * References:
 * - ANS-104 spec: https://github.com/ArweaveTeam/arweave-standards/blob/master/ans/ANS-104.md
 * - arbundles DataItem: https://github.com/Irys-xyz/arbundles
 */

import { getApiEndpoints } from '~/constant/api'
import { getIsTestnet } from '~/utils'

// ── Byte utilities ───────────────────────────────────────────────────────────

function concatBytes (...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

const encoder = new TextEncoder()
function strToBytes (s: string): Uint8Array {
  return encoder.encode(s)
}

function shortTo2ByteArray (n: number): Uint8Array {
  return new Uint8Array([n & 0xFF, (n >> 8) & 0xFF])
}

function longTo8ByteArray (n: number): Uint8Array {
  const out = new Uint8Array(8)
  let lo = n >>> 0
  let hi = Math.floor(n / 0x100000000) >>> 0
  for (let i = 0; i < 4; i++) { out[i] = lo & 0xFF; lo >>>= 8 }
  for (let i = 4; i < 8; i++) { out[i] = hi & 0xFF; hi >>>= 8 }
  return out
}

function uint8ArrayToBase64 (bytes: Uint8Array): string {
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64urlEncode (bytes: Uint8Array): string {
  return uint8ArrayToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// ── Avro zigzag tag serialization ────────────────────────────────────────────
// Mirrors AVSCTap.writeTags from arbundles/src/tags.js exactly.

const MAX_TAG_BYTES = 4096

function serializeTags (tags: { name: string; value: string }[]): Uint8Array {
  if (tags.length === 0) { return new Uint8Array(0) }

  const buf = new Uint8Array(MAX_TAG_BYTES)
  let pos = 0

  function ensureCapacity (additional: number) {
    if (pos + additional > MAX_TAG_BYTES) {
      throw new Error(`Serialized tags would exceed maximum (${MAX_TAG_BYTES} bytes)`)
    }
  }

  function writeLong (n: number) {
    if (n >= -1073741824 && n < 1073741824) {
      let m = n >= 0 ? n << 1 : (~n << 1) | 1
      do {
        ensureCapacity(1)
        buf[pos] = m & 0x7F
        m >>= 7
      } while (m && (buf[pos++]! |= 0x80))
    } else {
      let f = n >= 0 ? n * 2 : -n * 2 - 1
      do {
        ensureCapacity(1)
        buf[pos] = f & 0x7F
        f /= 128
      } while (f >= 1 && (buf[pos++]! |= 0x80))
    }
    pos++
  }

  function writeBytes (bytes: Uint8Array) {
    writeLong(bytes.length)
    ensureCapacity(bytes.length)
    buf.set(bytes, pos)
    pos += bytes.length
  }

  writeLong(tags.length)
  for (const tag of tags) {
    writeBytes(strToBytes(tag.name))
    writeBytes(strToBytes(tag.value))
  }
  writeLong(0)

  return buf.slice(0, pos)
}

// ── WebCrypto SHA-384 deepHash ───────────────────────────────────────────────
// Mirrors arbundles/src/deepHash.js using native crypto.subtle.

async function sha384 (data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-384', data))
}

type DeepHashChunk = Uint8Array | DeepHashChunk[]

async function deepHash (data: DeepHashChunk): Promise<Uint8Array> {
  if (Array.isArray(data)) {
    const tag = concatBytes(await sha384(strToBytes('list')), await sha384(strToBytes(data.length.toString())))
    let acc = await sha384(tag)
    for (const chunk of data) {
      acc = await sha384(concatBytes(acc, await deepHash(chunk)))
    }
    return acc
  }
  const tag = concatBytes(await sha384(strToBytes('blob')), await sha384(strToBytes(data.byteLength.toString())))
  return sha384(concatBytes(tag, await sha384(data)))
}

// ── DataItem construction (ANS-104, TypedEthereum sig type 7) ────────────────

const SIG_TYPE = 7
const SIG_LENGTH = 65
const OWNER_LENGTH = 42

function buildDataItem (
  data: Uint8Array,
  ownerBytes: Uint8Array,
  anchor: Uint8Array,
  tagCount: number,
  tagBytes: Uint8Array
): Uint8Array {
  if (ownerBytes.length !== OWNER_LENGTH) {
    throw new Error(`Owner must be ${OWNER_LENGTH} bytes, got ${ownerBytes.length}`)
  }
  if (anchor.length !== 32) {
    throw new Error(`Anchor must be 32 bytes, got ${anchor.length}`)
  }
  const length = 2 + SIG_LENGTH + OWNER_LENGTH + 1 + 1 + 32 + 8 + 8 + tagBytes.length + data.length
  const bytes = new Uint8Array(length)
  let o = 0

  bytes.set(shortTo2ByteArray(SIG_TYPE), o); o += 2
  o += SIG_LENGTH // signature stays zeroed — filled after signing
  bytes.set(ownerBytes, o); o += OWNER_LENGTH
  bytes[o++] = 0 // target_present = no target
  bytes[o++] = 1 // anchor_present = has anchor
  bytes.set(anchor, o); o += 32
  bytes.set(longTo8ByteArray(tagCount), o); o += 8
  bytes.set(longTo8ByteArray(tagBytes.length), o); o += 8
  if (tagBytes.length > 0) { bytes.set(tagBytes, o); o += tagBytes.length }
  bytes.set(data, o)

  return bytes
}

function getSignatureData (
  ownerBytes: Uint8Array,
  anchor: Uint8Array,
  tagBytes: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  return deepHash([
    strToBytes('dataitem'),
    strToBytes('1'),
    strToBytes(String(SIG_TYPE)),
    ownerBytes,
    new Uint8Array(0), // rawTarget — empty (no target)
    anchor,
    tagBytes,
    data
  ])
}

// ── Signing via LikeCoin backend ─────────────────────────────────────────────

async function signDataItem (
  sigData: Uint8Array,
  opts: { fileSize: number; ipfsHash: string; txHash: string; token: string }
): Promise<Uint8Array> {
  const apiEndpoints = getApiEndpoints()
  const res = await $fetch<{ signature: string }>(apiEndpoints.API_POST_ARWEAVE_V2_SIGN, {
    method: 'POST',
    body: {
      signatureData: uint8ArrayToBase64(sigData),
      fileSize: opts.fileSize,
      ipfsHash: opts.ipfsHash,
      txToken: 'BASEETH',
      txHash: opts.txHash
    },
    headers: { Authorization: opts.token ? `Bearer ${opts.token}` : '' }
  })
  return Uint8Array.from(atob(res.signature), c => c.charCodeAt(0))
}

// ── Main upload function ─────────────────────────────────────────────────────

export async function uploadToIrys (
  file: Uint8Array,
  opts: {
    tags: { name: string; value: string }[]
    fileSize: number
    ipfsHash: string
    txHash: string
    token: string
  }
): Promise<{ id: string }> {
  const apiEndpoints = getApiEndpoints()

  // 1. Get Ethereum address that owns the Irys node account
  const { publicKey } = await $fetch<{ publicKey: string }>(apiEndpoints.API_GET_ARWEAVE_V2_PUBLIC_KEY)
  const ownerBytes = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0))

  // 2. Generate random 32-byte anchor (matches SDK: randomBytes(32).toString('base64').slice(0,32))
  const rawRandom = crypto.getRandomValues(new Uint8Array(32))
  const anchorStr = btoa(String.fromCharCode(...rawRandom)).slice(0, 32)
  const anchor = strToBytes(anchorStr)

  // 3. Serialize tags to Avro binary
  const tagBytes = serializeTags(opts.tags)

  // 4. Compute deepHash signature data
  const sigData = await getSignatureData(ownerBytes, anchor, tagBytes, file)

  // 5. Sign via LikeCoin backend
  const signature = await signDataItem(sigData, opts)
  if (signature.length !== SIG_LENGTH) {
    throw new Error(`Invalid signature length: expected ${SIG_LENGTH} bytes, got ${signature.length}`)
  }

  // 6. Build DataItem binary and inject signature at offset 2
  const dataItem = buildDataItem(file, ownerBytes, anchor, opts.tags.length, tagBytes)
  dataItem.set(signature, 2)

  // 7. Compute DataItem ID = base64url(SHA-256(signature))
  const idBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', signature))
  const id = base64urlEncode(idBytes)

  // 8. POST raw binary to Irys node
  const irysUrl = getIsTestnet()
    ? 'https://devnet.irys.xyz/tx/base-eth'
    : 'https://node1.irys.xyz/tx/base-eth'

  const res = await fetch(irysUrl, {
    method: 'POST',
    body: dataItem,
    headers: { 'Content-Type': 'application/octet-stream' }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Irys upload failed (${res.status}): ${text}`)
  }

  return { id }
}
