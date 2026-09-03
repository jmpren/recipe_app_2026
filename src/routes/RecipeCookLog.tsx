import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { clearCookProgress } from '../lib/cookProgress'
import { logCook } from '../lib/cooks'
import { getRecipe } from '../lib/recipes'
import type { RecipeWithDetail } from '../types'

const STARS = [1, 2, 3, 4, 5]

export function RecipeCookLog() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [recipe, setRecipe] = useState<RecipeWithDetail | null | undefined>(undefined)
  const [rating, setRating] = useState<number | null>(null)
  const [servingsMade, setServingsMade] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getRecipe(id)
      .then((r) => {
        if (!active) return
        setRecipe(r)
        if (r?.servings != null) setServingsMade(String(r.servings))
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load recipe')
      })
    return () => {
      active = false
    }
  }, [id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const parsed = servingsMade.trim() ? Number.parseInt(servingsMade, 10) : null
      await logCook(id, {
        servingsMade: parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : null,
        rating,
        notes,
      })
      clearCookProgress(id)
      // The post-cook riff prompt slots in here in the next Phase 1 task.
      navigate(`/recipes/${id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log the cook.')
      setSaving(false)
    }
  }

  if (error && recipe === undefined) return <p className="rb-error">{error}</p>
  if (recipe === undefined) return <p className="rb-muted">Loading…</p>
  if (recipe === null) {
    return (
      <div className="rb-stack">
        <p className="rb-muted">That recipe doesn’t exist.</p>
        <Link to="/" className="rb-button rb-button--ghost">
          Back to recipes
        </Link>
      </div>
    )
  }

  return (
    <form className="rb-stack" onSubmit={handleSubmit}>
      <header className="rb-stack rb-stack--tight">
        <h1>Log this cook</h1>
        <p className="rb-muted">{recipe.title}</p>
      </header>

      <div className="rb-label">
        How was it?
        <div className="rb-rating" role="group" aria-label="Rating out of 5">
          {STARS.map((n) => (
            <button
              key={n}
              type="button"
              className={`rb-rating__star${rating != null && n <= rating ? ' is-on' : ''}`}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              aria-pressed={rating === n}
              onClick={() => setRating((cur) => (cur === n ? null : n))}
            >
              ★
            </button>
          ))}
          {rating != null && (
            <button
              type="button"
              className="rb-button rb-button--ghost"
              onClick={() => setRating(null)}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <label className="rb-label">
        Servings made
        <input
          className="rb-field"
          inputMode="numeric"
          value={servingsMade}
          onChange={(e) => setServingsMade(e.target.value)}
        />
      </label>

      <label className="rb-label">
        Notes
        <textarea
          className="rb-field"
          rows={4}
          placeholder="Anything worth remembering for next time?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {error && <p className="rb-error">{error}</p>}

      <div className="rb-form-actions">
        <button className="rb-button" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save cook log'}
        </button>
        <Link className="rb-button rb-button--ghost" to={`/recipes/${id}`}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
