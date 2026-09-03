import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RecipeForm } from '../components/RecipeForm'
import { getRecipe, recipeToDraft, updateRecipe } from '../lib/recipes'
import type { RecipeDraft, RecipeWithDetail } from '../types'

export function RecipeEdit() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<RecipeWithDetail | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getRecipe(id)
      .then((r) => {
        if (active) setRecipe(r)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load recipe')
      })
    return () => {
      active = false
    }
  }, [id])

  if (error) return <p className="rb-error">{error}</p>
  if (recipe === undefined) return <p className="rb-muted">Loading…</p>
  if (recipe === null) {
    return <p className="rb-muted">That recipe doesn’t exist.</p>
  }

  const loaded = recipe

  async function handleSubmit(draft: RecipeDraft, photo: File | null) {
    await updateRecipe(loaded.id, draft, photo, loaded.image_url)
    navigate(`/recipes/${loaded.id}`, { replace: true })
  }

  return (
    <div className="rb-stack">
      <h1>Edit recipe</h1>
      <RecipeForm
        key={loaded.id}
        initial={recipeToDraft(loaded)}
        initialImageUrl={loaded.image_url}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/recipes/${loaded.id}`)}
      />
    </div>
  )
}
