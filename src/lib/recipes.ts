import { RECIPE_PHOTOS_BUCKET, supabase } from './supabase'
import type { Recipe, RecipeDraft, RecipeRiff, RecipeWithDetail } from '../types'

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

export async function listRiffs(recipeId: string): Promise<RecipeRiff[]> {
  const { data, error } = await supabase
    .from('recipe_riffs')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
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

export async function createRecipe(draft: RecipeDraft, photo: File | null): Promise<Recipe> {
  const id = crypto.randomUUID()
  const image_url = photo ? await uploadRecipePhoto(id, photo) : null

  const { data, error } = await supabase.rpc('create_recipe', {
    payload: { id, image_url, ...draftToPayload(draft) },
  })
  if (error) throw error
  return data as Recipe
}
