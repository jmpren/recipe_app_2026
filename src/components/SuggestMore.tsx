import { useState } from 'react'
import { toISODate } from '../lib/dates'
import { planMeal } from '../lib/mealPlan'
import { suggestMeals } from '../lib/recipes'
import type { Recipe } from '../types'

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric' }

/** "Pick 1, suggest 3 more": given what's already on the week's plan, propose a
 *  few well-rated recipes that aren't on it yet, addable in one tap. */
export function SuggestMore({
  weekRecipeIds,
  days,
  householdId,
  onAdded,
}: {
  weekRecipeIds: string[]
  days: Date[]
  householdId?: string
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [picks, setPicks] = useState<Recipe[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [day, setDay] = useState(toISODate(days[0]))

  function load() {
    setBusy(true)
    setError(null)
    suggestMeals(0, 3, weekRecipeIds)
      .then(setPicks)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Couldn’t get suggestions'),
      )
      .finally(() => setBusy(false))
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && picks === null) load()
  }

  async function add(recipe: Recipe) {
    setBusy(true)
    setError(null)
    try {
      await planMeal(recipe.id, day, 'dinner', householdId)
      setPicks((p) => (p ?? []).filter((r) => r.id !== recipe.id))
      onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rb-suggest-more">
      <button type="button" className="rb-disclosure" aria-expanded={open} onClick={toggle}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> Need ideas for this week?
      </button>

      {open && (
        <div className="rb-stack rb-stack--tight">
          <div className="rb-form-actions">
            <span className="rb-muted">Add picks to</span>
            <select
              className="rb-field"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              aria-label="Day"
            >
              {days.map((d) => (
                <option key={toISODate(d)} value={toISODate(d)}>
                  {d.toLocaleDateString(undefined, DAY_FMT)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rb-button rb-button--ghost"
              onClick={load}
              disabled={busy}
            >
              {busy ? 'Thinking…' : picks ? 'Reshuffle' : 'Suggest'}
            </button>
          </div>

          {error && <p className="rb-error">{error}</p>}

          {picks === null ? null : picks.length === 0 ? (
            <p className="rb-muted">
              Nothing to suggest — add more recipes to your book, or reshuffle.
            </p>
          ) : (
            <ul className="rb-plan-picker__list">
              {picks.map((r) => (
                <li key={r.id} className="rb-suggest-more__row">
                  <span>{r.title}</span>
                  <button
                    type="button"
                    className="rb-button"
                    disabled={busy}
                    onClick={() => add(r)}
                  >
                    Add to dinner
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
