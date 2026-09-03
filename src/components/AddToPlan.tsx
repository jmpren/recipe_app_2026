import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toISODate, today } from '../lib/dates'
import { MEAL_SLOTS, planMeal, type MealSlot } from '../lib/mealPlan'

/** "Add to plan" control for the recipe detail page: pick a date + slot. */
export function AddToPlan({ recipeId }: { recipeId: string }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(toISODate(today()))
  const [slot, setSlot] = useState<MealSlot>('dinner')
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    setSaving(true)
    setError(null)
    try {
      await planMeal(recipeId, date, slot)
      setAdded(date)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add to plan')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <p className="rb-plan-add-line">
        <button
          type="button"
          className="rb-button rb-button--ghost"
          onClick={() => {
            setAdded(null)
            setError(null)
            setOpen(true)
          }}
        >
          Add to plan
        </button>
        {added && (
          <span className="rb-muted">
            {' '}
            Added for {added}. <Link to="/plan">View plan</Link>
          </span>
        )}
        {error && <span className="rb-error"> {error}</span>}
      </p>
    )
  }

  return (
    <div className="rb-plan-add">
      <input
        type="date"
        className="rb-field"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <select
        className="rb-field"
        value={slot}
        onChange={(e) => setSlot(e.target.value as MealSlot)}
        aria-label="Meal slot"
      >
        {MEAL_SLOTS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button type="button" className="rb-button" onClick={add} disabled={saving || !date}>
        {saving ? 'Adding…' : 'Add'}
      </button>
      <button
        type="button"
        className="rb-button rb-button--ghost"
        onClick={() => setOpen(false)}
        disabled={saving}
      >
        Cancel
      </button>
      {error && <p className="rb-error">{error}</p>}
    </div>
  )
}
