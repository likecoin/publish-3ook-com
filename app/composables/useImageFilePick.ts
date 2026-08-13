import { OPEN_IMAGE_FILE_TYPES } from '~/constant'

/**
 * Turns a file input's change event into an image File, or nothing.
 *
 * Shared by the wizard's cover card and the edit screen's 書檔 dropzone: both
 * reject the same types with the same message, and both have to clear the
 * input before reading it or picking the same file twice fires no event at all.
 */
export function useImageFilePick() {
  const { t: $t } = useI18n()
  const { showErrorToast } = useToastComposable()

  function rejectNonImage(file: File): boolean {
    if (OPEN_IMAGE_FILE_TYPES.includes(file.type)) { return false }
    showErrorToast($t('upload_form.unsupported_file_type_title'), {
      description: $t('upload_form.unsupported_file_type', { fileName: file.name }),
    })
    return true
  }

  function takeImageFile(event: Event): File | null {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || rejectNonImage(file)) { return null }
    return file
  }

  function takeDroppedImageFile(event: DragEvent): File | null {
    const file = event.dataTransfer?.files?.[0]
    if (!file || rejectNonImage(file)) { return null }
    return file
  }

  return { takeImageFile, takeDroppedImageFile }
}
