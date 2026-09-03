import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RecipeCard } from '../components/RecipeCard'
import { suggestMeals } from '../lib/recipes'
import type { Recipe } from '../types'

const WEEK_OPTIONS = [1, 2, 4, 8]

export function Suggestions() {
  const [weeks, setWeeks] = useState(2)
  const [nonce, setNonce] = useState(0) // bump to re-roll with the same window
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    suggestMeals(weeks, 6)
      .then((rows) => {
        if (!active) return
        setRecipes(rows)
        setError(null)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load suggestions')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [weeks, nonce])

  return (
    <div className="rb-stack">
      <div className="rb-list-head">
        <h1>What to cook</h1>
      </div>

      <div className="rb-suggest-controls">
        <label>
          Skip anything cooked in the last{' '}
          <select
            value={weeks}
            onChange={(e) => {
              setLoading(true)
              setWeeks(Number(e.target.value))
            }}
          >
            {WEEK_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w} {w === 1 ? 'week' : 'weeks'}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rb-button rb-button--ghost"
          onClick={() => {
            setLoading(true)
            setNonce((n) => n + 1)
          }}
          disabled={loading}
        >
          {loading ? 'Thinking…' : 'Shuffle'}
        </button>
      </div>

      {error && <p className="rb-error">{error}</p>}

      {recipes === null ? (
        <p className="rb-muted">Loading…</p>
      ) : recipes.length === 0 ? (
        <div className="rb-empty">
          <p className="rb-muted">
            Nothing to suggest right now — add more recipes, or widen the window above. Once
            you’ve rated a few cooks, your favorites float to the top here.
          </p>
          <Link to="/" className="rb-button rb-button--ghost">
            Back to recipes
          </Link>
        </div>
      ) : (
        <ul className="rb-grid">
          {recipes.map((r) => (
            <li key={r.id}>
              <RecipeCard recipe={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
