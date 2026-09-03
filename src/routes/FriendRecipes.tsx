import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RecipeCard } from '../components/RecipeCard'
import { getPersonName } from '../lib/friends'
import { listRecipesByOwner } from '../lib/recipes'
import type { Recipe } from '../types'

export function FriendRecipes() {
  const { friendId = '' } = useParams()
  const [name, setName] = useState<string | null>(null)
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([getPersonName(friendId), listRecipesByOwner(friendId)])
      .then(([n, rs]) => {
        if (!active) return
        setName(n)
        setRecipes(rs)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load')
      })
    return () => {
      active = false
    }
  }, [friendId])

  const heading = name ? `${name}’s recipes` : 'Friend’s recipes'
  const from = { to: `/friends/${friendId}`, label: heading }

  return (
    <div className="rb-stack">
      <Link to="/friends" className="rb-detail-back">
        <span aria-hidden="true">←</span> Friends
      </Link>
      <h1>{heading}</h1>

      {error && <p className="rb-error">{error}</p>}

      {recipes === null ? (
        <p className="rb-muted">Loading…</p>
      ) : recipes.length === 0 ? (
        <p className="rb-muted">
          {name
            ? `${name} hasn’t added any recipes yet — or you’re no longer connected.`
            : 'Nothing to show. You may not be connected with this person.'}
        </p>
      ) : (
        <ul className="rb-grid">
          {recipes.map((r) => (
            <li key={r.id}>
              <RecipeCard recipe={r} from={from} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
