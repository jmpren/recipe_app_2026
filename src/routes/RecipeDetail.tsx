import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AddToPlan } from '../components/AddToPlan'
import { StepNoteEditor } from '../components/StepNoteEditor'
import { TagEditor } from '../components/TagEditor'
import { predictedServings, type ServingsSuggestion } from '../lib/cooks'
import { getPersonName } from '../lib/friends'
import {
  deleteRecipe,
  getRecipe,
  listRiffs,
  listVersions,
  setRecipeServings,
  setStepNote,
} from '../lib/recipes'
import { SCALE_FACTORS, scaleFactorLabel, scaleStepText } from '../lib/scale'
import { convertAmounts, formatAmount, type ConvertedAmount, type UnitSystem } from '../lib/units'
import type { RecipeIngredient, RecipeRiff, RecipeVersionSummary, RecipeWithDetail } from '../types'

const UNIT_SYSTEMS: UnitSystem[] = ['original', 'metric', 'imperial']

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function RecipeDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [recipe, setRecipe] = useState<RecipeWithDetail | null | undefined>(undefined)
  const [riffs, setRiffs] = useState<RecipeRiff[]>([])
  const [riffsOpen, setRiffsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [ownerName, setOwnerName] = useState<string | null>(null)

  const isOwner = !recipe || recipe.owner_id === user?.id

  // Where the user came from — set by whoever linked here (RecipeCard `from`, a
  // calendar-day link, …). Falls back sensibly on a fresh load.
  const navState = useLocation().state as { backTo?: string; backLabel?: string } | null
  const backTo = navState?.backTo ?? (isOwner ? '/recipes' : '/friends')
  const backLabel = navState?.backLabel ?? (isOwner ? 'Recipe Book' : 'Friends')

  const [unitSystem, setUnitSystem] = useState<UnitSystem>('original')
  const [converted, setConverted] = useState<Partial<Record<'metric' | 'imperial', ConvertedAmount[]>>>({})
  const [convertError, setConvertError] = useState<string | null>(null)

  const [versions, setVersions] = useState<RecipeVersionSummary[]>([])
  const [versionView, setVersionView] = useState<'current' | 'original'>('current')
  const [servingsHint, setServingsHint] = useState<ServingsSuggestion | null>(null)
  const [scale, setScale] = useState(1)

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
    Promise.all([
      getRecipe(id),
      listRiffs(id),
      listVersions(id),
      predictedServings(id).catch(() => null), // advisory; never blocks the page
    ])
      .then(([r, rf, vs, hint]) => {
        if (!active) return
        setRecipe(r)
        setRiffs(rf)
        setVersions(vs)
        setServingsHint(hint)
        // New recipe -> drop any conversions cached for the previous one.
        setUnitSystem('original')
        setConverted({})
        setConvertError(null)
        setVersionView('current')
        setScale(1)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load recipe')
      })
    return () => {
      active = false
    }
  }, [id])

  // A friend's recipe → look up whose it is (for the "by …" line). Only rendered
  // when !isOwner, so a stale name from a previous recipe is never shown.
  useEffect(() => {
    if (!recipe || isOwner) return
    let active = true
    getPersonName(recipe.owner_id)
      .then((n) => {
        if (active) setOwnerName(n)
      })
      .catch(() => {
        /* the "by …" line just won't show a name */
      })
    return () => {
      active = false
    }
  }, [recipe, isOwner])

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

  const backLink = (
    <Link to={backTo} className="rb-detail-back">
      <span aria-hidden="true">←</span> {backLabel}
    </Link>
  )

  if (error) return <p className="rb-error">{error}</p>
  if (recipe === undefined) return <p className="rb-muted">Loading…</p>
  if (recipe === null) {
    return (
      <div className="rb-stack">
        {backLink}
        <p className="rb-muted">That recipe doesn’t exist.</p>
      </div>
    )
  }

  const meta = [
    recipe.servings ? `${recipe.servings} servings` : null,
    recipe.prep_minutes ? `${recipe.prep_minutes} min prep` : null,
    recipe.cook_minutes ? `${recipe.cook_minutes} min cook` : null,
  ].filter(Boolean)

  const originalVersion = versions.find((v) => v.is_original) ?? null
  const hasEdits = versions.some((v) => !v.is_original)
  const showingOriginal = versionView === 'original' && originalVersion != null

  const snapshotIngredients = originalVersion?.snapshot?.ingredients
    ? [...originalVersion.snapshot.ingredients].sort(byPosition)
    : []
  const snapshotSteps = originalVersion?.snapshot?.steps
    ? [...originalVersion.snapshot.steps].sort(byPosition)
    : []

  const showServingsHint =
    isOwner &&
    servingsHint != null &&
    (recipe.servings == null || servingsHint.suggestedServings !== recipe.servings)

  function scaledAmount(quantity: number | null, unit: string | null): string {
    return formatAmount(quantity != null ? quantity * scale : null, unit)
  }

  function ingredientAmount(index: number, ing: RecipeIngredient): string {
    if (unitSystem !== 'original') {
      const c = converted[unitSystem]?.[index]
      if (c) return scaledAmount(c.quantity, c.unit)
    }
    return scaledAmount(ing.quantity, ing.unit)
  }

  function renderStepText(instruction: string) {
    return scaleStepText(instruction, scale).segments.map((seg, i) =>
      seg.scaled ? (
        <mark key={i} className="rb-scaled">
          {seg.text}
        </mark>
      ) : (
        <span key={i}>{seg.text}</span>
      ),
    )
  }

  async function applySuggestedServings(n: number) {
    try {
      await setRecipeServings(id, n)
      setRecipe((r) => (r ? { ...r, servings: n } : r))
      setServingsHint(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Couldn’t update servings')
    }
  }

  async function saveStepNote(stepId: string, note: string) {
    await setStepNote(stepId, note)
    setRecipe((r) =>
      r
        ? {
            ...r,
            recipe_steps: r.recipe_steps.map((s) =>
              s.id === stepId ? { ...s, note: note || null } : s,
            ),
          }
        : r,
    )
  }

  return (
    <article className="rb-stack">
      {backLink}

      {recipe.image_url && (
        <img className="rb-detail-hero" src={recipe.image_url} alt="" />
      )}

      <header className="rb-stack rb-stack--tight">
        <h1>{recipe.title}</h1>
        {!isOwner && <p className="rb-muted">by {ownerName ?? 'a friend'} · view only</p>}
        {meta.length > 0 && <p className="rb-muted">{meta.join(' · ')}</p>}
        {recipe.source_url && (
          <p className="rb-muted">
            Source:{' '}
            <a href={recipe.source_url} target="_blank" rel="noreferrer">
              {recipe.source_name || recipe.source_url}
            </a>
          </p>
        )}
        {showServingsHint && servingsHint && (
          <p className="rb-nudge">
            Your {servingsHint.basedOnCooks} logged cooks average about{' '}
            {servingsHint.suggestedServings} servings
            {recipe.servings != null ? `, not the ${recipe.servings} set here` : ''}.{' '}
            <button
              type="button"
              className="rb-linklike"
              onClick={() => applySuggestedServings(servingsHint.suggestedServings)}
            >
              Update to {servingsHint.suggestedServings}
            </button>{' '}
            · <Link to={`/recipes/${recipe.id}/edit`}>edit</Link>
          </p>
        )}
      </header>

      {isOwner && (
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
      )}

      {isOwner && <AddToPlan recipeId={recipe.id} />}

      <TagEditor recipeId={recipe.id} readOnly={!isOwner} />

      {hasEdits && originalVersion && (
        <div className="rb-section-head">
          <span className="rb-muted">Version</span>
          <div className="rb-unit-toggle" role="group" aria-label="Recipe version">
            {(['current', 'original'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`rb-unit-toggle__opt${versionView === v ? ' is-on' : ''}`}
                aria-pressed={versionView === v}
                onClick={() => setVersionView(v)}
              >
                {v === 'current' ? 'Current' : 'Original'}
              </button>
            ))}
          </div>
        </div>
      )}

      {showingOriginal && originalVersion && (
        <p className="rb-muted">
          Showing the original version, saved {formatDate(originalVersion.created_at)}. Later edits
          aren’t shown here.
        </p>
      )}

      {recipe.description && <p>{recipe.description}</p>}

      {(recipe.recipe_ingredients.length > 0 || recipe.recipe_steps.length > 0) && (
        <div className="rb-section-head">
          <span className="rb-muted">Scale</span>
          <div className="rb-unit-toggle" role="group" aria-label="Scale recipe">
            {SCALE_FACTORS.map((f) => (
              <button
                key={f}
                type="button"
                className={`rb-unit-toggle__opt${scale === f ? ' is-on' : ''}`}
                aria-pressed={scale === f}
                onClick={() => setScale(f)}
              >
                {scaleFactorLabel(f)}
              </button>
            ))}
          </div>
        </div>
      )}

      <section>
        <div className="rb-section-head">
          <h2>Ingredients</h2>
          {!showingOriginal && recipe.recipe_ingredients.length > 0 && (
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
        {!showingOriginal && convertError && <p className="rb-muted">{convertError}</p>}
        {showingOriginal ? (
          snapshotIngredients.length === 0 ? (
            <p className="rb-muted">No ingredients listed.</p>
          ) : (
            <ul className="rb-ingredient-list">
              {snapshotIngredients.map((ing, i) => (
                <li key={i}>
                  <span className="rb-ingredient-qty">{scaledAmount(ing.quantity, ing.unit)}</span>{' '}
                  {ing.name}
                  {ing.notes && <span className="rb-muted"> — {ing.notes}</span>}
                </li>
              ))}
            </ul>
          )
        ) : recipe.recipe_ingredients.length === 0 ? (
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
        {showingOriginal ? (
          snapshotSteps.length === 0 ? (
            <p className="rb-muted">No steps listed.</p>
          ) : (
            <ol className="rb-step-list">
              {snapshotSteps.map((step, i) => (
                <li key={i}>
                  <p>{renderStepText(step.instruction)}</p>
                  {step.note && <p className="rb-step-note">{step.note}</p>}
                </li>
              ))}
            </ol>
          )
        ) : recipe.recipe_steps.length === 0 ? (
          <p className="rb-muted">No steps listed.</p>
        ) : (
          <ol className="rb-step-list">
            {recipe.recipe_steps.map((step) => (
              <li key={step.id}>
                <p>{renderStepText(step.instruction)}</p>
                <StepNoteEditor
                  note={step.note}
                  readOnly={!isOwner}
                  onSave={(note) => saveStepNote(step.id, note)}
                />
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
