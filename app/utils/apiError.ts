import { FetchError } from 'ofetch'

/**
 * The API's error handler sets `Content-Type: text/plain` before responding, so
 * ofetch never parses the body and `FetchError.message` is only ever the generic
 * `[POST] "<url>": 403`. The code the caller actually needs sits on `.data` — as
 * a bare string for a plain ValidationError, or as JSON *text* when the error
 * carries a payload, since the text/plain header survives `res.json()`.
 */
export function getApiErrorCode(error: unknown): string | undefined {
  const data = error instanceof FetchError ? error.data : undefined
  if (!data) { return undefined }
  if (typeof data === 'object') {
    const { error: code, message } = data as { error?: string, message?: string }
    return code || message || undefined
  }
  if (typeof data !== 'string') { return undefined }
  const body = data.trim()
  if (!body) { return undefined }
  if (!body.startsWith('{')) { return body }
  try {
    // Matches the object branch above: a body carrying neither field has no code
    // to report, so fall through to the error's own message rather than handing
    // the author raw JSON — which would also defeat isBatchFatalApiError.
    const parsed = JSON.parse(body) as { error?: string, message?: string }
    return parsed.error || parsed.message || undefined
  }
  catch {
    return body
  }
}

// Codes worth explaining in the author's own words. Anything unmapped falls
// through as the raw code, which still beats a bare status line.
const API_ERROR_I18N_KEYS: Record<string, string> = {
  DAILY_QUOTA_EXCEEDED: 'errors.api_daily_quota_exceeded',
  FILE_SIZE_LIMIT_EXCEEDED: 'errors.api_file_size_limit_exceeded',
  FILE_SIZE_MISMATCH: 'errors.api_upload_incomplete',
  STAGED_FILE_NOT_FOUND: 'errors.api_upload_incomplete',
  PLAINTEXT_HASH_MISMATCH: 'errors.api_upload_corrupted',
  NOT_OWNER: 'errors.api_not_owner',
  OPEN_BUCKET_NOT_CONFIGURED: 'errors.api_upload_unavailable',
  PROTECTED_BUCKET_NOT_CONFIGURED: 'errors.api_upload_unavailable',
}

/**
 * Codes that doom every remaining item in a batch, not just the current one.
 * The daily quota is per wallet per UTC day, so once it is spent nothing else
 * in the run can succeed and continuing only wastes the author's time.
 */
export function isBatchFatalApiError(error: unknown): boolean {
  return getApiErrorCode(error) === 'DAILY_QUOTA_EXCEEDED'
}

export function getApiErrorMessage(
  error: unknown,
  t: (key: string) => string,
): string {
  const code = getApiErrorCode(error)
  if (code) {
    const key = API_ERROR_I18N_KEYS[code]
    return key ? t(key) : code
  }
  return (error as Error)?.message || t('errors.unknown')
}
