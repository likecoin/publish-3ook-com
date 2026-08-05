/**
 * The bytes half of a draft, for any flow that collects files before it can
 * submit them.
 *
 * The JSON halves stay where they are — `publishSession.ts` in localStorage,
 * `bulkUploadSession.ts` in sessionStorage — and both deliberately drop the
 * blobs: a 200MB EPUB against a ~5MB quota. IndexedDB stores Blob natively at a
 * disk-fraction quota, which is what removes 「請重新選擇此檔案」 from the
 * common path.
 *
 * Each flow gets its own object store. They cannot share one: a fresh start in
 * either clears everything it can see, and the wizard clears on every mount
 * that finds no draft, so one shared store would mean opening 出版新書 wiping an
 * in-flight bulk batch.
 *
 * Nothing here throws or rejects. A publish must stay possible when storage is
 * unavailable, full, or evicted — every failure lands on today's behaviour,
 * which is to ask for the file again.
 */

const DB_NAME = 'publish-book-draft'
// v2 adds the bulk-upload store. The wizard's keeps its original name so an
// author mid-draft across the upgrade loses nothing.
const DB_VERSION = 2

const WIZARD_STORE_NAME = 'draft-files'
const BULK_UPLOAD_STORE_NAME = 'bulk-upload-files'
const STORE_NAMES = [WIZARD_STORE_NAME, BULK_UPLOAD_STORE_NAME]

export interface DraftFileRequest {
  key: string
  // Only where the flow recorded one. The wizard keys by content hash and knows
  // the size; bulk upload keys by filename and does not.
  expectedSize?: number
}

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
    let isSettled = false
    // Closes a connection that arrives after we have given up, so a block that
    // clears later cannot leave one open with nobody to close it.
    const settle = (db: IDBDatabase | null) => {
      if (isSettled) {
        db?.close()
        return
      }
      isSettled = true
      resolve(db)
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        // Creates whichever stores this version is missing, so the same handler
        // serves a first-time open and the v1 upgrade alike.
        STORE_NAMES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name)
          }
        })
      }
      request.onsuccess = () => settle(request.result)
      request.onerror = () => {
        warn('Failed to open the draft file store:', request.error)
        settle(null)
      }
      // Another tab holds an older version open; treat it as unavailable
      // rather than waiting on a tab this one cannot close. Reachable in
      // earnest now that a version bump exists to be blocked on.
      request.onblocked = () => settle(null)
    }
    catch (error) {
      warn('Failed to open the draft file store:', error)
      settle(null)
    }
  })
}

/**
 * Runs every request on one connection and one transaction, and resolves with
 * their results in order — or null if anything at all went wrong.
 *
 * Batched rather than one call per key: the resume path awaits this before the
 * prompt renders, and a draft has several files, so opening a connection per
 * file put that many round trips in front of the first paint.
 *
 * Waits for the transaction to complete rather than the request: a quota
 * failure surfaces there.
 */
function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>[],
): Promise<T[] | null> {
  return openDatabase().then(db => new Promise<T[] | null>((resolve) => {
    if (!db) {
      resolve(null)
      return
    }
    let isSettled = false
    const settle = (value: T[] | null) => {
      if (isSettled) { return }
      isSettled = true
      db.close()
      resolve(value)
    }
    // A connection force-closed by another tab's upgrade or by storage
    // eviction fires no transaction event at all, so without these the promise
    // would never settle — and the caller of this one is awaited before the
    // resume prompt can render.
    db.onversionchange = () => settle(null)
    db.onclose = () => settle(null)
    try {
      const transaction = db.transaction(storeName, mode)
      const requests = run(transaction.objectStore(storeName))
      const results: T[] = []
      requests.forEach((request, index) => {
        request.onsuccess = () => { results[index] = request.result }
      })
      transaction.oncomplete = () => settle(results)
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

function createDraftFileStore(storeName: string) {
  // One connection and one transaction for the batch. A flow with hundreds of
  // files would otherwise pay an open/close cycle each, which is the same cost
  // the batched read below exists to avoid.
  async function saveDraftFiles(entries: [string, Blob][]): Promise<boolean> {
    const wanted = entries.filter(([key]) => key)
    if (!wanted.length) { return true }
    const result = await runTransaction(storeName, 'readwrite', store =>
      wanted.map(([key, blob]) => store.put(blob, key)))
    return result !== null
  }

  function saveDraftFile(key: string, blob: Blob): Promise<boolean> {
    return saveDraftFiles([[key, blob]])
  }

  // Drops files the draft no longer refers to. Without this a file the author
  // removed, or a cover replaced five times, stays on disk until the whole
  // draft is cleared.
  async function deleteDraftFiles(keys: string[]): Promise<void> {
    const wanted = keys.filter(Boolean)
    if (!wanted.length) { return }
    await runTransaction(storeName, 'readwrite', store => wanted.map(key => store.delete(key)))
  }

  /**
   * Returns only the blobs that came back whole.
   *
   * expectedSize guards the one failure this cannot otherwise see: a stored blob
   * that reads back short would publish a truncated book. Without a recorded
   * size — drafts saved before it was persisted, or a flow that never had one —
   * any non-empty blob passes, which is still better than forcing a
   * re-selection.
   */
  async function loadDraftFiles(requests: DraftFileRequest[]): Promise<Map<string, Blob>> {
    const restored = new Map<string, Blob>()
    const keys = [...new Set(requests.map(request => request.key).filter(Boolean))]
    if (!keys.length) { return restored }

    const blobs = await runTransaction<Blob>(storeName, 'readonly', store => keys.map(key => store.get(key)))
    if (!blobs) { return restored }

    const sizeByKey = new Map(requests.map(request => [request.key, request.expectedSize]))
    keys.forEach((key, index) => {
      const blob = blobs[index]
      if (!(blob instanceof Blob) || !blob.size) { return }
      const expectedSize = sizeByKey.get(key)
      if (expectedSize && blob.size !== expectedSize) {
        warn('Discarding a draft file that read back the wrong size:', key)
        return
      }
      restored.set(key, blob)
    })
    return restored
  }

  // One flow's files, dropped whole with its draft. No history to evict, and
  // scoped to this store so the other flow's draft is untouched.
  async function clearDraftFiles(): Promise<void> {
    await runTransaction(storeName, 'readwrite', store => [store.clear()])
  }

  return { saveDraftFile, saveDraftFiles, deleteDraftFiles, loadDraftFiles, clearDraftFiles }
}

export const draftFileStore = createDraftFileStore(WIZARD_STORE_NAME)
export const bulkUploadFileStore = createDraftFileStore(BULK_UPLOAD_STORE_NAME)
