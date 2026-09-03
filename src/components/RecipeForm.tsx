import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { emptyDraft, emptyIngredient, emptyStep } from '../lib/draft'
import type { RecipeDraft } from '../types'

interface Props {
  initial?: RecipeDraft
  initialImageUrl?: string | null
  submitLabel: string
  onSubmit: (draft: RecipeDraft, photo: File | null) => Promise<void>
  onCancel?: () => void
}

export function RecipeForm({ initial, initialImageUrl, submitLabel, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<RecipeDraft>(() => initial ?? emptyDraft())
  const [photo, setPhoto] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const photoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  )
  useEffect(() => {
    if (!photoPreview) return
    return () => URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  const previewSrc = photoPreview ?? initialImageUrl ?? null

  function set<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.title.trim()) {
      setError('A title is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(draft, photo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <form className="rb-stack" onSubmit={handleSubmit}>
      <label className="rb-label">
        Title
        <input
          className="rb-field"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          required
        />
      </label>

      <label className="rb-label">
        Description
        <textarea
          className="rb-field"
          rows={3}
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </label>

      <div className="rb-row">
        <label className="rb-label">
          Source URL
          <input
            className="rb-field"
            type="url"
            value={draft.source_url}
            onChange={(e) => set('source_url', e.target.value)}
          />
        </label>
        <label className="rb-label">
          Source name
          <input
            className="rb-field"
            value={draft.source_name}
            onChange={(e) => set('source_name', e.target.value)}
          />
        </label>
      </div>

      <div className="rb-row">
        <label className="rb-label">
          Servings
          <input
            className="rb-field"
            inputMode="numeric"
            value={draft.servings}
            onChange={(e) => set('servings', e.target.value)}
          />
        </label>
        <label className="rb-label">
          Prep (min)
          <input
            className="rb-field"
            inputMode="numeric"
            value={draft.prep_minutes}
            onChange={(e) => set('prep_minutes', e.target.value)}
          />
        </label>
        <label className="rb-label">
          Cook (min)
          <input
            className="rb-field"
            inputMode="numeric"
            value={draft.cook_minutes}
            onChange={(e) => set('cook_minutes', e.target.value)}
          />
        </label>
      </div>

      <label className="rb-label">
        Photo
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
      </label>
      {previewSrc && (
        <img className="rb-form-preview" src={previewSrc} alt="Recipe preview" />
      )}

      <fieldset className="rb-fieldset">
        <legend>Ingredients</legend>
        {draft.ingredients.map((ing, i) => (
          <div className="rb-line" key={i}>
            <input
              className="rb-field rb-field--xs"
              placeholder="Qty"
              value={ing.quantity}
              onChange={(e) =>
                set(
                  'ingredients',
                  draft.ingredients.map((x, j) =>
                    j === i ? { ...x, quantity: e.target.value } : x,
                  ),
                )
              }
            />
            <input
              className="rb-field rb-field--sm"
              placeholder="Unit"
              value={ing.unit}
              onChange={(e) =>
                set(
                  'ingredients',
                  draft.ingredients.map((x, j) =>
                    j === i ? { ...x, unit: e.target.value } : x,
                  ),
                )
              }
            />
            <input
              className="rb-field"
              placeholder="Ingredient"
              value={ing.name}
              onChange={(e) =>
                set(
                  'ingredients',
                  draft.ingredients.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
            />
            <input
              className="rb-field rb-field--sm"
              placeholder="Notes"
              value={ing.notes}
              onChange={(e) =>
                set(
                  'ingredients',
                  draft.ingredients.map((x, j) =>
                    j === i ? { ...x, notes: e.target.value } : x,
                  ),
                )
              }
            />
            <button
              type="button"
              className="rb-icon-button"
              aria-label={`Remove ingredient ${i + 1}`}
              onClick={() =>
                set(
                  'ingredients',
                  draft.ingredients.filter((_, j) => j !== i),
                )
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rb-button rb-button--ghost"
          onClick={() => set('ingredients', [...draft.ingredients, emptyIngredient()])}
        >
          Add ingredient
        </button>
      </fieldset>

      <fieldset className="rb-fieldset">
        <legend>Steps</legend>
        {draft.steps.map((step, i) => (
          <div className="rb-line rb-line--step" key={i}>
            <span className="rb-step-num" aria-hidden="true">
              {i + 1}
            </span>
            <textarea
              className="rb-field"
              rows={2}
              placeholder={`Step ${i + 1}`}
              value={step.instruction}
              onChange={(e) =>
                set(
                  'steps',
                  draft.steps.map((x, j) =>
                    j === i ? { ...x, instruction: e.target.value } : x,
                  ),
                )
              }
            />
            <button
              type="button"
              className="rb-icon-button"
              aria-label={`Remove step ${i + 1}`}
              onClick={() =>
                set(
                  'steps',
                  draft.steps.filter((_, j) => j !== i),
                )
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rb-button rb-button--ghost"
          onClick={() => set('steps', [...draft.steps, emptyStep()])}
        >
          Add step
        </button>
      </fieldset>

      {error && <p className="rb-error">{error}</p>}

      <div className="rb-form-actions">
        <button className="rb-button" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            className="rb-button rb-button--ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
