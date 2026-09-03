import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  buildShoppingList,
  lineKey,
  loadStoredList,
  saveStoredList,
  type ShoppingLine,
} from '../lib/shopping'
import { listRecipes } from '../lib/recipes'
import { formatAmount } from '../lib/units'
import type { Recipe } from '../types'

export function ShoppingList() {
  const location = useLocation()
  const navigate = useNavigate()
  const seeded = (location.state as { recipeIds?: string[] } | null)?.recipeIds

  const [allRecipes, setAllRecipes] = useState<Recipe[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => {
    const stored = loadStoredList()
    return new Set(seeded && seeded.length ? seeded : stored.recipeIds)
  })
  const [checked, setChecked] = useState<Set<string>>(() => new Set(loadStoredList().checked))
  const [lines, setLines] = useState<ShoppingLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Consume the "from the plan" seed once so a refresh doesn't re-apply it.
  // (selected was already initialised from it.)
  useEffect(() => {
    if (seeded && seeded.length) navigate('/shopping', { replace: true, state: null })
  }, [seeded, navigate])

  useEffect(() => {
    let active = true
    listRecipes('')
      .then((rs) => {
        if (active) setAllRecipes(rs)
      })
      .catch(() => {
        /* the picker just shows nothing */
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    buildShoppingList([...selected])
      .then((rows) => {
        if (!active) return
        setLines(rows)
        setError(null)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to build the list')
      })
    return () => {
      active = false
    }
  }, [selected])

  useEffect(() => {
    saveStoredList({ recipeIds: [...selected], checked: [...checked] })
  }, [selected, checked])

  function toggleRecipe(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCheck(key: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedRecipes = allRecipes.filter((r) => selected.has(r.id))
  const remaining = (lines ?? []).filter((l) => !checked.has(lineKey(l))).length

  return (
    <div className="rb-stack">
      <div className="rb-list-head">
        <h1>Shopping list</h1>
        {(lines?.length ?? 0) > 0 && (
          <button
            type="button"
            className="rb-button rb-button--ghost"
            onClick={() => setChecked(new Set())}
          >
            Uncheck all
          </button>
        )}
      </div>

      <section className="rb-shop-recipes">
        <button
          type="button"
          className="rb-disclosure"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((v) => !v)}
        >
          <span aria-hidden="true">{pickerOpen ? '▾' : '▸'}</span> Recipes ({selected.size})
        </button>
        {selected.size > 0 && !pickerOpen && (
          <p className="rb-muted">{selectedRecipes.map((r) => r.title).join(' · ')}</p>
        )}
        {pickerOpen && (
          <ul className="rb-shop-picker">
            {allRecipes.length === 0 ? (
              <li className="rb-muted">No recipes yet.</li>
            ) : (
              allRecipes.map((r) => (
                <li key={r.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleRecipe(r.id)}
                    />{' '}
                    {r.title}
                  </label>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      {error && <p className="rb-error">{error}</p>}

      {selected.size === 0 ? (
        <div className="rb-empty">
          <p className="rb-muted">Pick a few recipes above to build a combined list.</p>
          <Link to="/recipes" className="rb-button rb-button--ghost">
            Browse the recipe book
          </Link>
        </div>
      ) : lines === null ? (
        <p className="rb-muted">Building…</p>
      ) : lines.length === 0 ? (
        <p className="rb-muted">Those recipes have no ingredients listed.</p>
      ) : (
        <>
          <p className="rb-muted">
            {remaining} of {lines.length} to get
          </p>
          <ul className="rb-shop-list">
            {lines.map((line) => {
              const key = lineKey(line)
              const isChecked = checked.has(key)
              const amount = formatAmount(line.quantity, line.unit)
              return (
                <li key={key} className={`rb-shop-item${isChecked ? ' is-checked' : ''}`}>
                  <label>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(key)} />{' '}
                    <span className="rb-shop-item__amount">{amount}</span> {line.name}
                    {line.has_unmeasured && line.quantity != null && (
                      <span className="rb-muted"> + more</span>
                    )}
                  </label>
                  {line.recipes.length > 0 && (
                    <span className="rb-muted rb-shop-item__from">
                      from {line.recipes.join(', ')}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
