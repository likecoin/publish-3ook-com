// from https://github.com/labscommunity/arweavekit/blob/main/src/lib/encryption.ts
//
// Decrypt only. The publish flow no longer encrypts in the browser — DRM ebooks
// go straight to the private CMEK bucket (ADR 0001 Phase 3) — but books uploaded
// before that still carry a client-side AES key and must stay readable.

function getWebCrypto() {
  let webCrypto: Crypto
  if (typeof window !== 'undefined' && window.crypto) {
    webCrypto = window.crypto
  }
  else {
    throw new Error('Crypto API is not available.')
  }
  return webCrypto
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

export async function decryptDataWithAES(
  params: { data: ArrayBuffer, key: string },
): Promise<ArrayBuffer> {
  if (params.data.byteLength < 12) {
    throw new Error('Invalid encrypted payload: data length is smaller than required 12-byte IV.')
  }

  const webCrypto = getWebCrypto()

  const iv = params.data.slice(0, 12)
  const ciphertext = params.data.slice(12)

  const rawKey = base64ToArrayBuffer(params.key)
  const cryptoKey = await webCrypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  )

  const decryptedData = await webCrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    cryptoKey,
    ciphertext,
  )

  return decryptedData
}
