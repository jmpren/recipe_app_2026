import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteRecipe, getRecipe, listRiffs } from '../lib/recipes'
import { convertAmounts, formatAmount, type ConvertedAmount, type UnitSystem } from '../lib/units'
import type { RecipeIngredient, RecipeRiff, RecipeWithDetail } from '../types'

const UNIT_SYSTEMS: UnitSystem[] = ['original', 'metric', 'imperial']

export function RecipeDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<RecipeWithDetail | null | undefined>(undefined)
  const [riffs, setRiffs] = useState<RecipeRiff[]>([])
  const [riffsOpen, setRiffsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [unitSystem, setUnitSystem] = useState<UnitSystem>('original')
  const [converted, setConverted] = useState<Partial<Record<'metric' | 'imperial', ConvertedAmount[]>>>({})
  const [convertError, setConvertError] = useState<string | null>(null)

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
        // New recipe -> drop any conversions cached for the previous one.
        setUnitSystem('original')
        setConverted({})
        setConvertError(null)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load recipe')
      })
    return () => {
      active = false
    }
  }, [id])

  // Fetch (once) the converted amounts for the chosen system. Stored data is
  // never touched — this is display only.
  useEffect(() => {
    if (unitSystem === 'original' || converted[unitSystem]) return
    if (!recipe || recipe.recipe_ingredients.length === 0) return
    let active = true
    convertAmounts(
      recipe.recipe_ingredients.map((i) => ({ quantity: i.quantity, unit: i.unit })),
      unitSystem,
    )
      .then((rows) => {
        if (active) setConverted((c) => ({ ...c, [unitSystem]: rows }))
      })
      .catch((e: unknown) => {
        if (!active) return
        setConvertError(e instanceof Error ? e.message : 'Couldn’t convert units')
        setUnitSystem('original')
      })
    return () => {
      active = false
    }
  }, [unitSystem, converted, recipe])

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

  function ingredientAmount(index: number, ing: RecipeIngredient): string {
    if (unitSystem !== 'original') {
      const c = converted[unitSystem]?.[index]
      if (c) return formatAmount(c.quantity, c.unit)
    }
    return formatAmount(ing.quantity, ing.unit)
  }

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
        <Link className="rb-button" to={`/recipes/${recipe.id}/cook`}>
          Cook this
        </Link>
        <Link className="rb-button rb-button--ghost" to={`/recipes/${recipe.id}/log`}>
          Log a cook
        </Link>
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
        <div className="rb-section-head">
          <h2>Ingredients</h2>
          {recipe.recipe_ingredients.length > 0 && (
            <div className="rb-unit-toggle" role="group" aria-label="Measurement units">
              {UNIT_SYSTEMS.map((sys) => (
                <button
                  key={sys}
                  type="button"
                  className={`rb-unit-toggle__opt${unitSystem === sys ? ' is-on' : ''}`}
                  aria-pressed={unitSystem === sys}
                  onClick={() => {
                    setConvertError(null)
                    setUnitSystem(sys)
                  }}
                >
                  {sys[0].toUpperCase() + sys.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
        {convertError && <p className="rb-muted">{convertError}</p>}
        {recipe.recipe_ingredients.length === 0 ? (
          <p className="rb-muted">No ingredients listed.</p>
        ) : (
          <ul className="rb-ingredient-list">
            {recipe.recipe_ingredients.map((ing, i) => (
              <li key={ing.id}>
                <span className="rb-ingredient-qty">{ingredientAmount(i, ing)}</span>{' '}
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
