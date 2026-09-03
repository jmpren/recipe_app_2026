import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RecipeCard } from '../components/RecipeCard'
import { listRecipes } from '../lib/recipes'
import type { Recipe } from '../types'

export function RecipeList() {
  const [search, setSearch] = useState('')
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      listRecipes(search)
        .then((rows) => {
          if (active) {
            setRecipes(rows)
            setError(null)
          }
        })
        .catch((e: unknown) => {
          if (active) setError(e instanceof Error ? e.message : 'Failed to load recipes')
        })
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [search])

  return (
    <div className="rb-stack">
      <div className="rb-list-head">
        <h1>Recipes</h1>
        <input
          className="rb-field"
          type="search"
          placeholder="Search by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search recipes by title"
        />
      </div>

      {error && <p className="rb-error">{error}</p>}

      {recipes === null ? (
        <p className="rb-muted">Loading…</p>
      ) : recipes.length === 0 ? (
        <div className="rb-empty">
          {search.trim() ? (
            <p className="rb-muted">No recipes match “{search.trim()}”.</p>
          ) : (
            <>
              <p className="rb-muted">No recipes yet.</p>
              <Link to="/recipes/new" className="rb-button">
                Add your first recipe
              </Link>
            </>
          )}
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
