import type { EpubMetadata, FileRecord } from '~/types'
import { isGeneratedCoverRecord, isManualCoverRecord } from '~/utils/arweave'

interface UseManualCoverOptions {
  fileRecords: Ref<FileRecord[]>
  // Resolves the metadata entry the cover belongs to, creating one when the
  // book has no EPUB to have supplied it. UploadForm may hold several entries
  // while files are being dropped; the wizard has exactly one by step 2.
  resolveTarget: () => EpubMetadata | undefined
}

/**
 * Owns the author's cover choice, outside the component that collects files.
 *
 * UploadForm is mounted only on the wizard's file step, so anything living
 * inside it is gone by the time step 2 offers 更換封面. Both callers therefore
 * share this instead: the drop path hands over a record it already built, the
 * step 2 path builds one from a File.
 */
export function useManualCover({ fileRecords, resolveTarget }: UseManualCoverOptions) {
  const generatedCoverRecord = computed(() =>
    fileRecords.value.find(record => isGeneratedCoverRecord(record)))

  const hasManualCover = computed(() =>
    fileRecords.value.some(record => isManualCoverRecord(record)))

  // 復原 needs a cover the EPUB supplied *and* the bytes to show it with. A
  // PDF book has neither; a draft resumed from localStorage has the record's
  // name but not its preview data, and reverting to a cover it cannot display
  // would just blank the field. Persisting the blobs is what restores it.
  const canRevertCover = computed(() =>
    !!generatedCoverRecord.value?.fileData && hasManualCover.value)

  function writeCoverToMetadata(record: FileRecord | undefined) {
    const target = resolveTarget()
    if (!target) { return }
    target.thumbnailIpfsHash = record?.ipfsHash ?? null
    target.coverData = record?.fileData ?? null
    // Cleared with the rest: a stale id would publish the cover that was just
    // replaced, since the edit flow derives coverUrl straight from it.
    target.thumbnailArweaveId = record?.arweaveId ?? null
  }

  // The generated cover is kept rather than replaced: it is what 復原 reverts
  // to, and buildIscnLinksFromFileRecords picks the manual one by provenance
  // rather than by position.
  function applyManualCover(record: FileRecord): FileRecord {
    // Stated, not left absent: isGeneratedCoverRecord falls back to the
    // filename when the flag is unset, so an author whose own file ends in
    // _cover.jpeg would have their pick read as the EPUB's — the very case
    // the flag exists to close.
    const manualRecord: FileRecord = { ...record, isGeneratedCover: false }
    fileRecords.value = [
      ...fileRecords.value.filter(existing => !isManualCoverRecord(existing)),
      manualRecord,
    ]
    writeCoverToMetadata(manualRecord)
    return manualRecord
  }

  // Throws on an unreadable file; callers already surface upload errors.
  async function selectManualCoverFile(file: File): Promise<FileRecord> {
    // Two independent full reads of the same file, so run them together.
    const [info, fileData] = await Promise.all([getFileInfo(file), fileToDataUrl(file)])
    if (!info) { throw new Error('Failed to read the selected cover image') }
    const record: FileRecord = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      fileBlob: file,
      ipfsHash: info.ipfsHash || undefined,
      fileSHA256: info.fileSHA256,
      fileData,
    }
    return applyManualCover(record)
  }

  function revertToGeneratedCover(): boolean {
    const generated = generatedCoverRecord.value
    if (!generated) { return false }
    fileRecords.value = fileRecords.value.filter(record => !isManualCoverRecord(record))
    writeCoverToMetadata(generated)
    return true
  }

  return {
    generatedCoverRecord,
    hasManualCover,
    canRevertCover,
    applyManualCover,
    selectManualCoverFile,
    revertToGeneratedCover,
  }
}
