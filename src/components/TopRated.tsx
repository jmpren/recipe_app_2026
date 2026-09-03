import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RecipeCard } from './RecipeCard'
import { topRatedRecipes } from '../lib/recipes'
import type { Recipe } from '../types'

const FROM = { to: '/', label: 'Home' }

export function TopRated() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)

  useEffect(() => {
    let active = true
    topRatedRecipes(6)
      .then((rs) => {
        if (active) setRecipes(rs)
      })
      .catch(() => {
        if (active) setRecipes([])
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="rb-stack rb-stack--tight">
      <div className="rb-list-head">
        <h2>Top rated</h2>
        <Link to="/recipes" className="rb-linklike">
          All recipes →
        </Link>
      </div>

      {recipes === null ? (
        <p className="rb-muted">Loading…</p>
      ) : recipes.length === 0 ? (
        <p className="rb-muted">
          Rate a few cooks and your best recipes will surface here.
        </p>
      ) : (
        <ul className="rb-grid">
          {recipes.map((r) => (
            <li key={r.id}>
              <RecipeCard recipe={r} from={FROM} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
