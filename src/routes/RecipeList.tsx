import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRecipes } from '../lib/recipes'
import type { Recipe } from '../types'

function totalMinutes(r: Recipe): number | null {
  const sum = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)
  return sum > 0 ? sum : null
}

function cardMeta(r: Recipe): string {
  const mins = totalMinutes(r)
  return [r.servings ? `${r.servings} servings` : null, mins ? `${mins} min` : null]
    .filter(Boolean)
    .join(' · ')
}

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
          {recipes.map((r) => {
            const meta = cardMeta(r)
            return (
              <li key={r.id}>
                <Link to={`/recipes/${r.id}`} className="rb-recipe-card">
                  <div className="rb-recipe-card__media">
                    {r.image_url ? (
                      <img src={r.image_url} alt="" loading="lazy" />
                    ) : (
                      <span className="rb-recipe-card__placeholder" aria-hidden="true">
                        🍲
                      </span>
                    )}
                  </div>
                  <div className="rb-recipe-card__body">
                    <h2>{r.title}</h2>
                    {r.description && <p className="rb-clamp-2 rb-muted">{r.description}</p>}
                    {meta && <p className="rb-recipe-card__meta rb-muted">{meta}</p>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
