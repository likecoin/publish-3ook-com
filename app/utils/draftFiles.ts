/**
 * The bytes half of the wizard draft.
 *
 * publishSession.ts owns the JSON in localStorage and deliberately drops the
 * blobs — a 200MB EPUB against a ~5MB quota. IndexedDB stores Blob natively at
 * a disk-fraction quota, which is what removes 「請重新選擇此檔案」 from the
 * common path.
 *
 * Keyed by fileSHA256: already computed for every record, stable across
 * reloads, and content-addressed, so re-selecting an identical file dedupes
 * for free.
 *
 * Nothing here throws or rejects. A publish must stay possible when storage is
 * unavailable, full, or evicted — every failure lands on today's behaviour,
 * which is to ask for the file again.
 */

const DB_NAME = 'publish-book-draft'
const DB_VERSION = 1
const STORE_NAME = 'draft-files'

function warn(message: string, error: unknown): void {
  // eslint-disable-next-line no-console
  console.warn(message, error)
}

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    // Private browsing can leave the global missing entirely rather than
    // failing the open, and prerendering has no window at all.
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        warn('Failed to open the draft file store:', request.error)
        resolve(null)
      }
      // Another tab holds an older version open; treat it as unavailable
      // rather than waiting on a tab this one cannot close.
      request.onblocked = () => resolve(null)
    }
    catch (error) {
      warn('Failed to open the draft file store:', error)
      resolve(null)
    }
  })
}

// Resolves with the request's result, or null if anything at all went wrong.
// Waits for the transaction to complete on writes: a quota failure surfaces
// there, not on the request.
function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDatabase().then(db => new Promise<T | null>((resolve) => {
    if (!db) {
      resolve(null)
      return
    }
    let result: T | null = null
    const settle = (value: T | null) => {
      db.close()
      resolve(value)
    }
    try {
      const transaction = db.transaction(STORE_NAME, mode)
      const request = run(transaction.objectStore(STORE_NAME))
      request.onsuccess = () => { result = request.result }
      transaction.oncomplete = () => settle(result)
      transaction.onerror = () => {
        warn('Draft file transaction failed:', transaction.error)
        settle(null)
      }
      transaction.onabort = () => {
        warn('Draft file transaction aborted:', transaction.error)
        settle(null)
      }
    }
    catch (error) {
      warn('Draft file transaction failed:', error)
      settle(null)
    }
  }))
}

export async function saveDraftFile(fileSHA256: string, blob: Blob): Promise<boolean> {
  if (!fileSHA256) { return false }
  const result = await runTransaction('readwrite', store => store.put(blob, fileSHA256))
  return result !== null
}

/**
 * Returns only the blobs that came back whole.
 *
 * expectedSize guards the one failure this cannot otherwise see: a stored blob
 * that reads back short would publish a truncated book. Without a recorded
 * size — drafts saved before it was persisted — any non-empty blob passes,
 * which is still better than forcing a re-selection.
 */
export async function loadDraftFiles(
  records: { fileSHA256?: string, fileSize?: number }[],
): Promise<Map<string, Blob>> {
  const restored = new Map<string, Blob>()
  const hashes = [...new Set(records.map(record => record.fileSHA256).filter(Boolean))]
  if (!hashes.length) { return restored }

  const sizeByHash = new Map(
    records.filter(record => record.fileSHA256).map(record => [record.fileSHA256!, record.fileSize]),
  )
  for (const hash of hashes) {
    const blob = await runTransaction<Blob>('readonly', store => store.get(hash!))
    if (!(blob instanceof Blob) || !blob.size) { continue }
    const expectedSize = sizeByHash.get(hash!)
    if (expectedSize && blob.size !== expectedSize) {
      warn('Discarding a draft file that read back the wrong size:', hash)
      continue
    }
    restored.set(hash!, blob)
  }
  return restored
}

// One draft's files, dropped whole with the draft. No history to evict.
export async function clearDraftFiles(): Promise<void> {
  await runTransaction('readwrite', store => store.clear())
}
