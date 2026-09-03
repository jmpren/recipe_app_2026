import type { Database } from './lib/database.types'

export type Recipe = Database['public']['Tables']['recipes']['Row']
export type RecipeIngredient = Database['public']['Tables']['recipe_ingredients']['Row']
export type RecipeStep = Database['public']['Tables']['recipe_steps']['Row']
export type RecipeVersion = Database['public']['Tables']['recipe_versions']['Row']
export type RecipeRiff = Database['public']['Tables']['recipe_riffs']['Row']
export type CookLog = Database['public']['Tables']['cook_logs']['Row']

/** A recipe with its ingredients + steps, ordered by position. */
export interface RecipeWithDetail extends Recipe {
  recipe_ingredients: RecipeIngredient[]
  recipe_steps: RecipeStep[]
}

/** Shape of `recipe_versions.snapshot` — written by create_recipe / update_recipe. */
export interface VersionSnapshot {
  ingredients: {
    position: number
    quantity: number | null
    unit: string | null
    name: string
    notes: string | null
  }[]
  steps: { position: number; instruction: string; note: string | null }[]
}

export interface RecipeVersionSummary {
  id: string
  label: string
  is_original: boolean
  created_at: string
  snapshot: VersionSnapshot
}

/** One editable ingredient line in the recipe form (pre-persist). */
export interface IngredientDraft {
  quantity: string
  unit: string
  name: string
  notes: string
}

/** One editable step line in the recipe form (pre-persist). */
export interface StepDraft {
  instruction: string
}

export interface RecipeDraft {
  title: string
  description: string
  source_url: string
  source_name: string
  servings: string
  prep_minutes: string
  cook_minutes: string
  ingredients: IngredientDraft[]
  steps: StepDraft[]
}
