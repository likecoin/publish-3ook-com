import { FetchError } from 'ofetch'
import { getApiEndpoints } from '~/constant/api'
import { decryptDataWithAES } from '~/utils/encryption'

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

// Carries the i18n key of the failure worth naming to the author.
export class BookFileFetchError extends Error {
  constructor(public readonly i18nKey: string) {
    super(i18nKey)
    this.name = 'BookFileFetchError'
  }
}

// Fetches a book file's plaintext from any URL a book can carry: ar://, ipfs://,
// the API's link route (legacy keyed or protected tier) or a plain https link.
export function useBookFileFetch() {
  const apiFetch = useLikeCoApiFetch()
  const { ARWEAVE_ENDPOINT } = useRuntimeConfig().public

  async function resolveUrl(
    rawUrl: string,
  ): Promise<{ fileUrl: string, key?: string, requiresAuth: boolean }> {
    const apiEndpoints = getApiEndpoints()
    const arweaveLinkEndpoint = apiEndpoints.API_GET_ARWEAVE_V2_LINK

    if (rawUrl.startsWith(arweaveLinkEndpoint)) {
      const expected = new URL(arweaveLinkEndpoint)
      const parsedRawUrl = new URL(rawUrl)
      // Match the normalised pathname, not the raw string: `${endpoint}/../../wallet/x`
      // passes startsWith and the origin check but resolves to another API path, and
      // apiFetch would put the author's bearer token on whatever it resolved to.
      if (parsedRawUrl.origin !== expected.origin
        || !parsedRawUrl.pathname.startsWith(`${expected.pathname}/`)) {
        throw new Error('URL does not match the expected API endpoint')
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
          if (err.response?.status === 401) { throw new BookFileFetchError('preview_book.error_unauthorized') }
          if (err.response?.status === 403) {
            const token = parsedRawUrl.searchParams.get('token')?.trim()
            throw new BookFileFetchError(token ? 'preview_book.error_invalid_token' : 'preview_book.error_missing_token')
          }
        }
        throw err
      }
      // Use hasPublicCopy (not `link`) to decide: encrypted docs can return a `link` that serves ciphertext.
      // Protected books (ADR 0001 Phase 3) only expose a gs:// contentUri,
      // so both must use the owner-authed content route instead.
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

  // A decrypted file comes back untyped: the stored Content-Type described the
  // ciphertext, so only an unencrypted fetch keeps it.
  async function fetchBookFile(rawUrl: string): Promise<Blob> {
    let resolved: Awaited<ReturnType<typeof resolveUrl>>
    try {
      resolved = await resolveUrl(rawUrl)
    }
    catch (err) {
      if (err instanceof BookFileFetchError) { throw err }
      throw new BookFileFetchError('preview_book.error_resolve')
    }
    const { fileUrl, key } = resolved

    let blob: Blob
    try {
      // apiFetch attaches the bearer token to absolute URLs too, so it is only safe
      // for our own content route — using it for ar:// or ipfs:// targets would ship
      // the author's JWT to arweave.net or w3s.link.
      const fetchFile = resolved.requiresAuth ? apiFetch : $fetch
      blob = await fetchFile<Blob>(fileUrl, { responseType: 'blob' })
    }
    catch (err) {
      // Only our own content route: a 401 from arweave.net or w3s.link says nothing
      // about book ownership, and telling the author to log in would misdirect them.
      const status = resolved.requiresAuth && err instanceof FetchError
        ? err.response?.status
        : undefined
      throw new BookFileFetchError(status === 401
        ? 'preview_book.error_unauthorized'
        : 'preview_book.error_fetch')
    }

    if (!key) { return blob }
    try {
      return new Blob([await decryptDataWithAES({ data: await blob.arrayBuffer(), key })])
    }
    catch {
      throw new BookFileFetchError('preview_book.error_decrypt')
    }
  }

  return { fetchBookFile }
}
