import { RECIPE_PHOTOS_BUCKET, supabase } from './supabase'
import { emptyIngredient, emptyStep } from './draft'
import type {
  Recipe,
  RecipeDraft,
  RecipeRiff,
  RecipeVersionSummary,
  RecipeWithDetail,
  VersionSnapshot,
} from '../types'

const strOrEmpty = (v: number | null) => (v == null ? '' : String(v))

function intOrNull(v: string): number | null {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

function numOrNull(v: string): number | null {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : null
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position

export async function listRecipes(search = ''): Promise<Recipe[]> {
  let query = supabase.from('recipes').select('*').order('created_at', { ascending: false })

  const term = search.trim()
  if (term) {
    query = query.ilike('title', `%${term}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Meal-planning candidates from the `suggest_meals` RPC: excludes recipes cooked
 * in the last `excludeWeeks`, biases toward well-rated ones, rotates on each
 * call. All the ranking is server-side (PLAN.md §3).
 */
export async function suggestMeals(excludeWeeks: number, limitCount = 6): Promise<Recipe[]> {
  const { data, error } = await supabase.rpc('suggest_meals', {
    exclude_weeks: excludeWeeks,
    limit_count: limitCount,
  })
  if (error) throw error
  return (data as Recipe[] | null) ?? []
}

export async function getRecipe(id: string): Promise<RecipeWithDetail | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*), recipe_steps(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
    recipe_ingredients: [...data.recipe_ingredients].sort(byPosition),
    recipe_steps: [...data.recipe_steps].sort(byPosition),
  }
}

/**
 * The recipe's version history, oldest first. Row 1 is always the mandatory
 * `is_original` snapshot; a row per Edit-screen save after that (PLAN.md §5/§7).
 * Plain read — RLS scopes it to the owner.
 */
export async function listVersions(recipeId: string): Promise<RecipeVersionSummary[]> {
  const { data, error } = await supabase
    .from('recipe_versions')
    .select('id, label, is_original, created_at, snapshot')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((v) => ({ ...v, snapshot: v.snapshot as unknown as VersionSnapshot }))
}

export async function listRiffs(recipeId: string): Promise<RecipeRiff[]> {
  const { data, error } = await supabase
    .from('recipe_riffs')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Record a riff via the create_riff RPC. Always retrospective — it needs the
 * cook_log_id of a cook that just happened (PLAN.md §7). There is no other entry
 * point; a riff is never a blank/speculative entry and never an edit.
 */
export async function createRiff(
  cookLogId: string,
  label: string,
  whatChanged: string,
): Promise<RecipeRiff> {
  const { data, error } = await supabase.rpc('create_riff', {
    cook_log_id: cookLogId,
    label: label.trim(),
    what_changed: whatChanged.trim() || undefined,
  })
  if (error) throw error
  return data as RecipeRiff
}

/**
 * Set (or clear, when blank) the inline note on one step. A plain column write —
 * deliberately NOT routed through update_recipe: step notes are personal
 * annotations, not a permanent edit, so they never create a recipe_versions row
 * (PLAN.md §5 / §7). RLS scopes the update to the owner.
 */
/**
 * Set `recipes.servings` directly (used by the serving-size-learning nudge).
 * A plain column write, NOT update_recipe: correcting the default from cook
 * history is reconciling metadata, not a recipe revision, so it never creates a
 * recipe_versions row. RLS scopes it to the owner.
 */
export async function setRecipeServings(recipeId: string, servings: number): Promise<void> {
  const { data, error } = await supabase
    .from('recipes')
    .update({ servings, updated_at: new Date().toISOString() })
    .eq('id', recipeId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('That recipe no longer exists.')
}

export async function setStepNote(stepId: string, note: string): Promise<void> {
  const { data, error } = await supabase
    .from('recipe_steps')
    .update({ note: note.trim() || null })
    .eq('id', stepId)
    .select('id')
  if (error) throw error
  // No row back = RLS hid it / bad id; surface it rather than failing silently.
  if (!data || data.length === 0) throw new Error('That step no longer exists.')
}

async function uploadRecipePhoto(recipeId: string, file: File): Promise<string> {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('Not signed in')

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${recipeId}/cover.${ext}`

  const { error } = await supabase.storage
    .from(RECIPE_PHOTOS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined })
  if (error) throw error

  return supabase.storage.from(RECIPE_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Build the jsonb payload create_recipe / update_recipe expect from a form draft. */
export function draftToPayload(draft: RecipeDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    source_url: draft.source_url.trim() || null,
    source_name: draft.source_name.trim() || null,
    servings: intOrNull(draft.servings),
    prep_minutes: intOrNull(draft.prep_minutes),
    cook_minutes: intOrNull(draft.cook_minutes),
    ingredients: draft.ingredients
      .filter((i) => i.name.trim())
      .map((i, position) => ({
        position,
        quantity: numOrNull(i.quantity),
        unit: i.unit.trim() || null,
        name: i.name.trim(),
        notes: i.notes.trim() || null,
      })),
    steps: draft.steps
      .filter((s) => s.instruction.trim())
      .map((s, position) => ({ position, instruction: s.instruction.trim(), note: null })),
  }
}

/**
 * @param fallbackImageUrl used as `image_url` when the user didn't upload a
 *        photo — e.g. the cover image found by the URL importer. A remote URL in
 *        this text column is fine for `<img src>`; no copy into our bucket.
 */
export async function createRecipe(
  draft: RecipeDraft,
  photo: File | null,
  fallbackImageUrl: string | null = null,
): Promise<Recipe> {
  const id = crypto.randomUUID()
  const image_url = photo ? await uploadRecipePhoto(id, photo) : fallbackImageUrl

  const { data, error } = await supabase.rpc('create_recipe', {
    payload: { id, image_url, ...draftToPayload(draft) },
  })
  if (error) throw error
  return data as Recipe
}

/** Hydrate the shared form from a persisted recipe (Edit screen). */
export function recipeToDraft(recipe: RecipeWithDetail): RecipeDraft {
  return {
    title: recipe.title,
    description: recipe.description ?? '',
    source_url: recipe.source_url ?? '',
    source_name: recipe.source_name ?? '',
    servings: strOrEmpty(recipe.servings),
    prep_minutes: strOrEmpty(recipe.prep_minutes),
    cook_minutes: strOrEmpty(recipe.cook_minutes),
    ingredients: recipe.recipe_ingredients.length
      ? recipe.recipe_ingredients.map((i) => ({
          quantity: strOrEmpty(i.quantity),
          unit: i.unit ?? '',
          name: i.name,
          notes: i.notes ?? '',
        }))
      : [emptyIngredient()],
    steps: recipe.recipe_steps.length
      ? recipe.recipe_steps.map((s) => ({ instruction: s.instruction }))
      : [emptyStep()],
  }
}

/**
 * Save a permanent edit. update_recipe replaces ingredients/steps and records a
 * new recipe_versions row server-side (Edit == permanent — PLAN.md §7). When no
 * new photo is picked, the current image_url is passed through unchanged.
 */
export async function updateRecipe(
  id: string,
  draft: RecipeDraft,
  photo: File | null,
  currentImageUrl: string | null,
): Promise<Recipe> {
  const image_url = photo ? await uploadRecipePhoto(id, photo) : currentImageUrl

  const { data, error } = await supabase.rpc('update_recipe', {
    payload: { id, image_url, ...draftToPayload(draft) },
  })
  if (error) throw error
  return data as Recipe
}

/**
 * Delete a recipe. Child rows (ingredients, steps, versions, cook logs, riffs)
 * go with it via ON DELETE CASCADE. Photo objects in the recipe-photos bucket are
 * left in place for now — Storage has no cascade, and orphan cleanup is not a
 * Phase 1 concern.
 */
export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) throw error
}
