/**
 * On-device OCR via tesseract.js (WASM). Loaded dynamically — the ~megabytes of
 * worker + wasm + language data are only fetched the first time someone scans.
 * OCR itself is inherently platform-specific (a Swift client would use Apple's
 * Vision framework), so there's nothing to share; the reusable half — turning
 * the recognised text into a recipe — is the `parse-recipe-text` Edge Function.
 */
export async function runOcr(
  image: File | Blob,
  onProgress?: (status: string, fraction: number) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js')

  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      onProgress?.(m.status, m.progress)
    },
  })

  try {
    const { data } = await worker.recognize(image)
    return data.text ?? ''
  } finally {
    await worker.terminate()
  }
}
