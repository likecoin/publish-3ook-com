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

  // 復原 only means something when there is a cover the EPUB supplied to go
  // back to, so a PDF book must not be offered it.
  const canRevertCover = computed(() =>
    !!generatedCoverRecord.value && hasManualCover.value)

  function writeCoverToMetadata(record: FileRecord | undefined) {
    const target = resolveTarget()
    if (!target) { return }
    target.thumbnailIpfsHash = record?.ipfsHash ?? null
    target.coverData = record?.fileData ?? null
    // Cleared with the rest: a stale id would publish the cover that was just
    // replaced, since the edit flow derives coverUrl straight from it.
    target.thumbnailArweaveId = record?.arweaveId ?? null
  }

  /**
   * Makes an already-built image record the book's cover.
   *
   * One cover per book, so a second choice replaces the first rather than
   * stacking rows that only fail at 下一步. The generated cover is kept: it is
   * what 復原 reverts to, and buildIscnLinksFromFileRecords picks the manual
   * one by provenance regardless of order.
   */
  function applyManualCover(record: FileRecord) {
    fileRecords.value = [
      ...fileRecords.value.filter(existing => !isManualCoverRecord(existing)),
      record,
    ]
    writeCoverToMetadata(record)
  }

  // Throws on an unreadable file; callers already surface upload errors.
  async function selectManualCoverFile(file: File): Promise<FileRecord> {
    const info = await getFileInfo(file)
    if (!info) { throw new Error('Failed to read the selected cover image') }
    const record: FileRecord = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      fileBlob: file,
      ipfsHash: info.ipfsHash || undefined,
      fileSHA256: info.fileSHA256,
      fileData: await fileToDataUrl(file),
    }
    applyManualCover(record)
    return record
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
