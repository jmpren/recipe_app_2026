import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { RecipeForm } from '../components/RecipeForm'
import { importRecipeFromUrl, parseScannedText } from '../lib/import'
import { runOcr } from '../lib/ocr'
import { createRecipe } from '../lib/recipes'
import type { RecipeDraft } from '../types'

export function RecipeNew() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<'choose' | 'form'>('choose')
  const [initial, setInitial] = useState<RecipeDraft | undefined>(undefined)
  const [importedImageUrl, setImportedImageUrl] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<string | null>(null)

  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [scanStatus, setScanStatus] = useState<string | null>(null)

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    setImporting(true)
    try {
      const { draft, found, imageUrl } = await importRecipeFromUrl(trimmed)
      setInitial(draft)
      setImportedImageUrl(imageUrl)
      setImportNote(
        found
          ? 'Imported from the page — double-check everything before saving.'
          : 'Couldn’t read that page automatically. The URL is saved as the source; fill in the rest.',
      )
      setMode('form')
    } finally {
      setImporting(false)
    }
  }

  async function handleScan(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return

    setScanStatus('Reading the photo…')
    try {
      const text = await runOcr(file, (status, fraction) => {
        setScanStatus(
          status === 'recognizing text'
            ? `Reading the photo… ${Math.round(fraction * 100)}%`
            : `Getting ready… (${status})`,
        )
      })
      const { draft, found } = await parseScannedText(text)
      setInitial(draft)
      setImportedImageUrl(null)
      setImportNote(
        found
          ? 'Scanned from the photo — OCR is rough, so check every line before saving.'
          : 'Couldn’t make out a recipe in that photo. Starting you with a blank form.',
      )
      setMode('form')
    } catch (err) {
      setScanStatus(
        err instanceof Error ? `Scan failed: ${err.message}` : 'Scan failed. Try another photo.',
      )
    }
  }

  function startFromScratch() {
    setInitial(undefined)
    setImportedImageUrl(null)
    setImportNote(null)
    setMode('form')
  }

  async function handleSubmit(draft: RecipeDraft, photo: File | null) {
    const recipe = await createRecipe(draft, photo, importedImageUrl)
    navigate(`/recipes/${recipe.id}`, { replace: true })
  }

  const busy = importing || (scanStatus !== null && !scanStatus.startsWith('Scan failed'))

  return (
    <div className="rb-stack">
      <h1>Add a recipe</h1>

      {mode === 'choose' ? (
        <form className="rb-stack" onSubmit={handleImport}>
          <label className="rb-label">
            Paste a recipe URL
            <input
              className="rb-field"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>

          <div className="rb-form-actions">
            <button className="rb-button" type="submit" disabled={busy}>
              {importing ? 'Fetching…' : 'Import from URL'}
            </button>
            <button
              type="button"
              className="rb-button rb-button--ghost"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              Scan a photo
            </button>
            <button
              type="button"
              className="rb-button rb-button--ghost"
              onClick={startFromScratch}
              disabled={busy}
            >
              Start from scratch
            </button>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={handleScan}
          />
          {scanStatus && <p className="rb-muted">{scanStatus}</p>}
        </form>
      ) : (
        <>
          {importNote && <p className="rb-muted">{importNote}</p>}
          <RecipeForm
            initial={initial}
            initialImageUrl={importedImageUrl}
            submitLabel="Save recipe"
            onSubmit={handleSubmit}
            onCancel={() => navigate(-1)}
          />
        </>
      )}
    </div>
  )
}
