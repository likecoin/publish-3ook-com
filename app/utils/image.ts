// Resolves null when the source already fits within `maxSize`, so the caller
// can keep the original bytes. The decode doubles as validation — non-image
// inputs reject via the `<img>` error event.
function drawAndExport(url: string, maxSize: number, quality: number): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      if (img.width <= maxSize && img.height <= maxSize) {
        resolve(null)
        return
      }
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (out) => {
          if (!out) {
            reject(new Error('Failed to resize image'))
            return
          }
          resolve(out)
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => reject(new Error('Invalid image'))
    img.src = url
  })
}

export async function resizeImageFile(
  file: File,
  maxSize: number,
  quality = 0.85,
): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const blob = await drawAndExport(url, maxSize, quality)
    return blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file
  }
  finally {
    URL.revokeObjectURL(url)
  }
}
