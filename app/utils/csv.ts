// The default entry reads the Node `Buffer` global at module scope, before
// plugins/buffer.client.ts can install it. The browser build ships its own.
import { stringify as csvStringify } from 'csv-stringify/browser/esm/sync'

/**
 * Download array of objects as CSV with BOM for Excel compatibility with Chinese characters
 * @param data - Array of objects to export
 * @param columns - Column definitions with key and display label
 * @param filename - Output filename
 */
export async function downloadCSV(
  data: Record<string, unknown>[],
  columns: { accessorKey: string, header: string }[],
  filename: string,
) {
  if (data.length === 0) {
    return
  }

  const { saveAs } = await import('file-saver')

  // Map data to columns and use csv-stringify for proper escaping
  const rows = data.map(row =>
    columns.map(col => row[col.accessorKey] ?? ''),
  )

  const csvContent = csvStringify(rows, {
    header: true,
    columns: columns.map(col => col.header),
  })

  // Add BOM for Excel compatibility with Chinese characters
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, filename)
}

export function downloadFile({ data, fileName, fileType }: { data: Record<string, unknown> | Record<string, unknown>[], fileName: string, fileType: string }) {
  let fileData
  let mimeType
  if (fileType === 'json') {
    fileData = JSON.stringify(data, null, 2)
    mimeType = 'application/json'
  }
  else if (fileType === 'csv') {
    fileData = convertArrayOfObjectsToCSV(Array.isArray(data) ? data : [data])
    mimeType = 'text/csv'
  }
  else {
    throw new Error('Unsupported file type')
  }

  const fileBlob = new Blob([fileData], { type: mimeType })
  const fileUrl = URL.createObjectURL(fileBlob)
  const fileLink = document.createElement('a')
  fileLink.href = fileUrl
  fileLink.download = fileName
  fileLink.style.display = 'none'

  document.body.appendChild(fileLink)
  fileLink.click()
  document.body.removeChild(fileLink)
}

export function convertArrayOfObjectsToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) {
    return ''
  }
  return csvStringify(data, { header: true })
}
