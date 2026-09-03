import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RecipeCard } from '../components/RecipeCard'
import { listRecipes } from '../lib/recipes'
import { getRecipeTagMap, type Tag } from '../lib/tags'
import type { Recipe } from '../types'

export function RecipeList() {
  const [search, setSearch] = useState('')
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [tagMap, setTagMap] = useState<Map<string, Tag[]>>(new Map())
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())

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

  useEffect(() => {
    let active = true
    getRecipeTagMap()
      .then((m) => {
        if (active) setTagMap(m)
      })
      .catch(() => {
        /* filtering just won't be available */
      })
    return () => {
      active = false
    }
  }, [])

  const allTags = useMemo(() => {
    const seen = new Map<string, Tag>()
    for (const arr of tagMap.values()) for (const t of arr) seen.set(t.id, t)
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [tagMap])

  function toggleTag(id: string) {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const shown = (recipes ?? []).filter((r) => {
    if (activeTags.size === 0) return true
    const rt = new Set((tagMap.get(r.id) ?? []).map((t) => t.id))
    return [...activeTags].every((id) => rt.has(id))
  })

  return (
    <div className="rb-stack">
      <div className="rb-list-head">
        <h1>Recipe Book</h1>
        <input
          className="rb-field"
          type="search"
          placeholder="Search by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search recipes by title"
        />
      </div>

      {allTags.length > 0 && (
        <div className="rb-tag-filter">
          {allTags.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rb-tag-filter__chip${activeTags.has(t.id) ? ' is-on' : ''}`}
              aria-pressed={activeTags.has(t.id)}
              onClick={() => toggleTag(t.id)}
            >
              {t.name}
            </button>
          ))}
          {activeTags.size > 0 && (
            <button
              type="button"
              className="rb-linklike"
              onClick={() => setActiveTags(new Set())}
            >
              clear
            </button>
          )}
        </div>
      )}

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
      ) : shown.length === 0 ? (
        <p className="rb-muted">No recipes match the selected tags.</p>
      ) : (
        <ul className="rb-grid">
          {shown.map((r) => (
            <li key={r.id}>
              <RecipeCard
                recipe={r}
                tags={tagMap.get(r.id)}
                from={{ to: '/recipes', label: 'Recipe Book' }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
