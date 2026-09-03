import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteRecipe, getRecipe, listRiffs } from '../lib/recipes'
import type { RecipeRiff, RecipeWithDetail } from '../types'

function formatQuantity(quantity: number | null, unit: string | null): string {
  return [quantity ?? '', unit ?? ''].join(' ').trim()
}

export function RecipeDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<RecipeWithDetail | null | undefined>(undefined)
  const [riffs, setRiffs] = useState<RecipeRiff[]>([])
  const [riffsOpen, setRiffsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!window.confirm('Delete this recipe? This can’t be undone.')) return
    setDeleting(true)
    try {
      await deleteRecipe(id)
      navigate('/', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete recipe')
      setDeleting(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([getRecipe(id), listRiffs(id)])
      .then(([r, rf]) => {
        if (!active) return
        setRecipe(r)
        setRiffs(rf)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load recipe')
      })
    return () => {
      active = false
    }
  }, [id])

  if (error) return <p className="rb-error">{error}</p>
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

  const meta = [
    recipe.servings ? `${recipe.servings} servings` : null,
    recipe.prep_minutes ? `${recipe.prep_minutes} min prep` : null,
    recipe.cook_minutes ? `${recipe.cook_minutes} min cook` : null,
  ].filter(Boolean)

  return (
    <article className="rb-stack">
      {recipe.image_url && (
        <img className="rb-detail-hero" src={recipe.image_url} alt="" />
      )}

      <header className="rb-stack rb-stack--tight">
        <h1>{recipe.title}</h1>
        {meta.length > 0 && <p className="rb-muted">{meta.join(' · ')}</p>}
        {recipe.source_url && (
          <p className="rb-muted">
            Source:{' '}
            <a href={recipe.source_url} target="_blank" rel="noreferrer">
              {recipe.source_name || recipe.source_url}
            </a>
          </p>
        )}
      </header>

      <div className="rb-form-actions">
        <Link className="rb-button rb-button--ghost" to={`/recipes/${recipe.id}/edit`}>
          Edit
        </Link>
        <button
          type="button"
          className="rb-button rb-button--ghost rb-button--danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      {recipe.description && <p>{recipe.description}</p>}

      <section>
        <h2>Ingredients</h2>
        {recipe.recipe_ingredients.length === 0 ? (
          <p className="rb-muted">No ingredients listed.</p>
        ) : (
          <ul className="rb-ingredient-list">
            {recipe.recipe_ingredients.map((ing) => (
              <li key={ing.id}>
                <span className="rb-ingredient-qty">
                  {formatQuantity(ing.quantity, ing.unit)}
                </span>{' '}
                {ing.name}
                {ing.notes && <span className="rb-muted"> — {ing.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Steps</h2>
        {recipe.recipe_steps.length === 0 ? (
          <p className="rb-muted">No steps listed.</p>
        ) : (
          <ol className="rb-step-list">
            {recipe.recipe_steps.map((step) => (
              <li key={step.id}>
                <p>{step.instruction}</p>
                {step.note && <p className="rb-step-note">{step.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rb-riffs">
        <button
          type="button"
          className="rb-disclosure"
          aria-expanded={riffsOpen}
          onClick={() => setRiffsOpen((v) => !v)}
        >
          <span aria-hidden="true">{riffsOpen ? '▾' : '▸'}</span> Riffs ({riffs.length})
        </button>
        {riffsOpen && (
          <div className="rb-stack rb-stack--tight">
            {riffs.length === 0 ? (
              <p className="rb-muted">
                No riffs yet. Riffs are captured right after you log a cook.
              </p>
            ) : (
              riffs.map((riff) => (
                <div key={riff.id} className="rb-riff">
                  <strong>{riff.label}</strong>
                  {riff.what_changed && <p className="rb-muted">{riff.what_changed}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </article>
  )
}
