let pdfjsLib: typeof import('pdfjs-dist') | null = null

// pdf.js and its worker are a large chunk, so it loads lazily and is shared.
async function loadPdfJs() {
  if (pdfjsLib) { return pdfjsLib }
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  pdfjsLib = pdfjs
  return pdfjs
}

// The cmaps are what make CJK text draw rather than come out blank, so every
// caller needs them passed. Detaches `data`: callers must not read it after.
export async function getPdfDocument(data: ArrayBuffer) {
  const pdfjs = await loadPdfJs()
  return pdfjs.getDocument({
    data,
    wasmUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/wasm/`,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
  }).promise
}
