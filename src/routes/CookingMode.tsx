import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getRecipe } from '../lib/recipes'
import { useWakeLock } from '../lib/useWakeLock'
import type { RecipeWithDetail } from '../types'

const progressKey = (recipeId: string) => `rb-cook:${recipeId}`

function loadChecked(recipeId: string): string[] {
  try {
    const raw = localStorage.getItem(progressKey(recipeId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveChecked(recipeId: string, ids: string[]) {
  try {
    localStorage.setItem(progressKey(recipeId), JSON.stringify(ids))
  } catch {
    // Private mode / quota — progress just won't survive a reload.
  }
}

/** Short beep via WebAudio; silently does nothing if the context can't start. */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
    osc.onended = () => void ctx.close()
  } catch {
    // ignore
  }
}

function formatQuantity(quantity: number | null, unit: string | null): string {
  return [quantity ?? '', unit ?? ''].join(' ').trim()
}

function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function StepTimer() {
  const [minutes, setMinutes] = useState('5')
  // null = idle (no timer set); otherwise seconds left, counting to 0.
  const [remaining, setRemaining] = useState<number | null>(null)
  const done = remaining === 0

  useEffect(() => {
    if (remaining === null || remaining <= 0) return
    const t = setTimeout(() => setRemaining((s) => (s === null ? null : s - 1)), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  useEffect(() => {
    if (!done) return
    beep()
    navigator.vibrate?.([200, 100, 200])
  }, [done])

  function start() {
    const m = Number.parseFloat(minutes)
    if (!Number.isFinite(m) || m <= 0) return
    setRemaining(Math.round(m * 60))
  }

  if (remaining === null) {
    return (
      <div className="rb-cook-timer">
        <input
          className="rb-field rb-field--xs"
          inputMode="decimal"
          aria-label="Timer minutes"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <span className="rb-muted">min</span>
        <button type="button" className="rb-button rb-button--ghost" onClick={start}>
          Start timer
        </button>
      </div>
    )
  }

  return (
    <div className={`rb-cook-timer${done ? ' rb-cook-timer--done' : ''}`}>
      <span className="rb-cook-timer__clock">{done ? 'Time’s up' : mmss(remaining)}</span>
      <button
        type="button"
        className="rb-button rb-button--ghost"
        onClick={() => setRemaining(null)}
      >
        {done ? 'Clear' : 'Cancel'}
      </button>
    </div>
  )
}

export function CookingMode() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  useWakeLock()

  const [recipe, setRecipe] = useState<RecipeWithDetail | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [ingredientsOpen, setIngredientsOpen] = useState(false)

  useEffect(() => {
    let active = true
    getRecipe(id)
      .then((r) => {
        if (!active) return
        setRecipe(r)
        if (r) setChecked(new Set(loadChecked(id)))
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load recipe')
      })
    return () => {
      active = false
    }
  }, [id])

  // Persist tick-box progress so a reload / accidental exit doesn't lose it.
  useEffect(() => {
    if (recipe) saveChecked(id, [...checked])
  }, [checked, id, recipe])

  // Esc closes the ingredients sheet.
  useEffect(() => {
    if (!ingredientsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIngredientsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ingredientsOpen])

  function toggleStep(stepId: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) next.delete(stepId)
      else next.add(stepId)
      return next
    })
  }

  function finish() {
    // Log-a-cook will slot in here in a later Phase 1 task; for now just exit.
    try {
      localStorage.removeItem(progressKey(id))
    } catch {
      // ignore
    }
    navigate(`/recipes/${id}`)
  }

  const doneCount = useMemo(
    () => (recipe ? recipe.recipe_steps.filter((s) => checked.has(s.id)).length : 0),
    [recipe, checked],
  )

  if (error) {
    return (
      <div className="rb-cook">
        <p className="rb-error">{error}</p>
        <Link className="rb-button rb-button--ghost" to={`/recipes/${id}`}>
          Back to recipe
        </Link>
      </div>
    )
  }
  if (recipe === undefined) return <p className="rb-cook rb-muted">Loading…</p>
  if (recipe === null) {
    return (
      <div className="rb-cook">
        <p className="rb-muted">That recipe doesn’t exist.</p>
        <Link className="rb-button rb-button--ghost" to="/">
          Back to recipes
        </Link>
      </div>
    )
  }

  return (
    <div className="rb-cook">
      <div className="rb-cook-bar">
        <Link className="rb-cook-exit" to={`/recipes/${recipe.id}`} aria-label="Exit cooking mode">
          ✕
        </Link>
        <span className="rb-cook-bar__title">{recipe.title}</span>
        <span className="rb-muted">
          {doneCount}/{recipe.recipe_steps.length}
        </span>
      </div>

      <div className="rb-cook-body">
        <section className="rb-cook-ingredients">
          <h2>Ingredients</h2>
          {recipe.recipe_ingredients.length === 0 ? (
            <p className="rb-muted">No ingredients listed.</p>
          ) : (
            <ul className="rb-cook-ingredient-list">
              {recipe.recipe_ingredients.map((ing) => (
                <li key={ing.id}>
                  <span className="rb-ingredient-qty">{formatQuantity(ing.quantity, ing.unit)}</span>{' '}
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
            <ol className="rb-cook-steps">
              {recipe.recipe_steps.map((step, i) => {
                const isDone = checked.has(step.id)
                return (
                  <li key={step.id} className={`rb-cook-step${isDone ? ' rb-cook-step--done' : ''}`}>
                    <button
                      type="button"
                      className="rb-cook-step__tap"
                      aria-pressed={isDone}
                      onClick={() => toggleStep(step.id)}
                    >
                      <span className="rb-cook-step__check" aria-hidden="true">
                        {isDone ? '✓' : i + 1}
                      </span>
                      <span className="rb-cook-step__text">{step.instruction}</span>
                    </button>
                    {step.note && <p className="rb-step-note">{step.note}</p>}
                    <StepTimer />
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <button type="button" className="rb-button" onClick={finish}>
          Finish cooking
        </button>
      </div>

      <button
        type="button"
        className="rb-cook-fab"
        onClick={() => setIngredientsOpen(true)}
        aria-haspopup="dialog"
      >
        Ingredients
      </button>

      {ingredientsOpen && (
        <div
          className="rb-cook-sheet-backdrop"
          role="dialog"
          aria-label="Ingredients"
          onClick={() => setIngredientsOpen(false)}
        >
          <div className="rb-cook-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rb-cook-sheet__head">
              <h2>Ingredients</h2>
              <button
                type="button"
                className="rb-button rb-button--ghost"
                onClick={() => setIngredientsOpen(false)}
              >
                Close
              </button>
            </div>
            {recipe.recipe_ingredients.length === 0 ? (
              <p className="rb-muted">No ingredients listed.</p>
            ) : (
              <ul className="rb-cook-ingredient-list">
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
          </div>
        </div>
      )}
    </div>
  )
}
