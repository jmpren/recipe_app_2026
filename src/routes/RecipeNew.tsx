import { useNavigate } from 'react-router-dom'
import { RecipeForm } from '../components/RecipeForm'
import { createRecipe } from '../lib/recipes'
import type { RecipeDraft } from '../types'

export function RecipeNew() {
  const navigate = useNavigate()

  async function handleSubmit(draft: RecipeDraft, photo: File | null) {
    const recipe = await createRecipe(draft, photo)
    navigate(`/recipes/${recipe.id}`, { replace: true })
  }

  return (
    <div className="rb-stack">
      <h1>Add a recipe</h1>
      <RecipeForm
        submitLabel="Save recipe"
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
      />
    </div>
  )
}
