import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { RecipeForm } from '../components/RecipeForm'
import { importRecipeFromUrl } from '../lib/import'
import { createRecipe } from '../lib/recipes'
import type { RecipeDraft } from '../types'

export function RecipeNew() {
  const navigate = useNavigate()

  const [mode, setMode] = useState<'choose' | 'form'>('choose')
  const [initial, setInitial] = useState<RecipeDraft | undefined>(undefined)
  const [importedImageUrl, setImportedImageUrl] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<string | null>(null)

  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)

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
            <button className="rb-button" type="submit" disabled={importing}>
              {importing ? 'Fetching…' : 'Import from URL'}
            </button>
            <button
              type="button"
              className="rb-button rb-button--ghost"
              onClick={startFromScratch}
              disabled={importing}
            >
              Start from scratch
            </button>
          </div>
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
