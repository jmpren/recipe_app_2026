import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDays, startOfWeek, toISODate, today } from '../lib/dates'
import {
  getPlan,
  MEAL_SLOTS,
  planMeal,
  unplanMeal,
  type MealPlanEntry,
  type MealSlot,
} from '../lib/mealPlan'
import { listRecipes } from '../lib/recipes'
import type { Recipe } from '../types'

const SLOT_RANK: Record<MealSlot, number> = { dinner: 0, breakfast: 1, lunch: 2, snack: 3 }
const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
const RANGE_FMT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

export function MealPlan() {
  const navigate = useNavigate()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today()))
  const [nonce, setNonce] = useState(0)
  const [entries, setEntries] = useState<MealPlanEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [allRecipes, setAllRecipes] = useState<Recipe[]>([])
  const [addingDay, setAddingDay] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [addSlot, setAddSlot] = useState<MealSlot>('dinner')
  const [busy, setBusy] = useState(false)

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
  const todayISO = toISODate(today())

  useEffect(() => {
    let active = true
    getPlan(toISODate(weekStart), toISODate(weekEnd))
      .then((rows) => {
        if (!active) return
        setEntries(rows)
        setError(null)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load the plan')
      })
    return () => {
      active = false
    }
  }, [weekStart, weekEnd, nonce])

  useEffect(() => {
    let active = true
    listRecipes('')
      .then((rs) => {
        if (active) setAllRecipes(rs)
      })
      .catch(() => {
        /* the picker just shows no options */
      })
    return () => {
      active = false
    }
  }, [])

  const reload = () => setNonce((n) => n + 1)

  function openAdd(dayISO: string) {
    setAddingDay(dayISO)
    setSearch('')
    setAddSlot('dinner')
  }

  async function add(recipeId: string) {
    if (!addingDay) return
    setBusy(true)
    try {
      await planMeal(recipeId, addingDay, addSlot)
      setAddingDay(null)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add to plan')
    } finally {
      setBusy(false)
    }
  }

  async function remove(entryId: string) {
    setBusy(true)
    try {
      await unplanMeal(entryId)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t remove entry')
    } finally {
      setBusy(false)
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const term = search.trim().toLowerCase()
  const matches = (term
    ? allRecipes.filter((r) => r.title.toLowerCase().includes(term))
    : allRecipes
  ).slice(0, 8)

  const entriesFor = (iso: string) =>
    (entries ?? [])
      .filter((e) => e.planned_on === iso)
      .sort((a, b) => SLOT_RANK[a.slot] - SLOT_RANK[b.slot] || a.position - b.position)

  return (
    <div className="rb-stack">
      <div className="rb-list-head">
        <h1>Meal plan</h1>
        <div className="rb-week-nav">
          <button
            type="button"
            className="rb-button rb-button--ghost"
            aria-label="Previous week"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            ‹
          </button>
          <button
            type="button"
            className="rb-button rb-button--ghost"
            onClick={() => setWeekStart(startOfWeek(today()))}
          >
            This week
          </button>
          <button
            type="button"
            className="rb-button rb-button--ghost"
            aria-label="Next week"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            ›
          </button>
        </div>
      </div>

      <div className="rb-plan-subhead">
        <p className="rb-muted">
          {weekStart.toLocaleDateString(undefined, RANGE_FMT)} –{' '}
          {weekEnd.toLocaleDateString(undefined, RANGE_FMT)}
        </p>
        {(entries?.length ?? 0) > 0 && (
          <button
            type="button"
            className="rb-button rb-button--ghost"
            onClick={() =>
              navigate('/shopping', {
                state: { recipeIds: [...new Set((entries ?? []).map((e) => e.recipe.id))] },
              })
            }
          >
            Shopping list for this week
          </button>
        )}
      </div>

      {error && <p className="rb-error">{error}</p>}

      {entries === null ? (
        <p className="rb-muted">Loading…</p>
      ) : (
        <ul className="rb-plan">
          {days.map((day) => {
            const iso = toISODate(day)
            const dayEntries = entriesFor(iso)
            return (
              <li key={iso} className={`rb-plan-day${iso === todayISO ? ' is-today' : ''}`}>
                <div className="rb-plan-day__label">
                  {day.toLocaleDateString(undefined, DAY_FMT)}
                </div>
                <div className="rb-plan-day__body">
                  {dayEntries.length === 0 && addingDay !== iso && (
                    <span className="rb-muted rb-plan-empty">Nothing planned</span>
                  )}

                  {dayEntries.map((e) => (
                    <div key={e.id} className="rb-plan-entry">
                      {e.slot !== 'dinner' && <span className="rb-slot-tag">{e.slot}</span>}
                      <Link to={`/recipes/${e.recipe.id}`}>{e.recipe.title}</Link>
                      <button
                        type="button"
                        className="rb-icon-button rb-icon-button--sm"
                        aria-label={`Remove ${e.recipe.title}`}
                        onClick={() => remove(e.id)}
                        disabled={busy}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {addingDay === iso ? (
                    <div className="rb-plan-picker">
                      <div className="rb-plan-picker__controls">
                        <input
                          className="rb-field"
                          type="search"
                          autoFocus
                          placeholder="Find a recipe…"
                          value={search}
                          onChange={(ev) => setSearch(ev.target.value)}
                        />
                        <select
                          className="rb-field"
                          value={addSlot}
                          onChange={(ev) => setAddSlot(ev.target.value as MealSlot)}
                          aria-label="Meal slot"
                        >
                          {MEAL_SLOTS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="rb-button rb-button--ghost"
                          onClick={() => setAddingDay(null)}
                        >
                          Cancel
                        </button>
                      </div>
                      {matches.length === 0 ? (
                        <p className="rb-muted">No matching recipes.</p>
                      ) : (
                        <ul className="rb-plan-picker__list">
                          {matches.map((r) => (
                            <li key={r.id}>
                              <button
                                type="button"
                                className="rb-linklike"
                                disabled={busy}
                                onClick={() => add(r.id)}
                              >
                                {r.title}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="rb-plan-add-btn"
                      onClick={() => openAdd(iso)}
                    >
                      + add
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
