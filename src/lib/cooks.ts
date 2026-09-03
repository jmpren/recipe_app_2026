import { supabase } from './supabase'
import type { CookLog } from '../types'

export interface CookLogInput {
  servingsMade: number | null
  rating: number | null
  notes: string
}

/**
 * Record one cook via the log_cook RPC. Every finished cook writes a cook_logs
 * row — it's the data every Phase 2 feature (servings prediction, favorites
 * bias, repeat limits) reads. Validation and the ownership check live in the
 * function, not here (PLAN.md §3).
 */
export async function logCook(recipeId: string, input: CookLogInput): Promise<CookLog> {
  const { data, error } = await supabase.rpc('log_cook', {
    recipe_id: recipeId,
    servings_made: input.servingsMade ?? undefined,
    rating: input.rating ?? undefined,
    notes: input.notes.trim() || undefined,
  })
  if (error) throw error
  return data as CookLog
}

export interface ServingsSuggestion {
  suggestedServings: number
  basedOnCooks: number
}

/**
 * Serving-size learning: what the recipe seems to actually yield, from logged
 * cooks. null until there's enough history (see the `predicted_servings` RPC).
 * Advisory only — the caller decides whether to surface a nudge.
 */
export async function predictedServings(recipeId: string): Promise<ServingsSuggestion | null> {
  const { data, error } = await supabase.rpc('predicted_servings', { recipe_id: recipeId })
  if (error) throw error
  if (!data) return null
  const d = data as { suggested_servings: number; based_on_cooks: number }
  return { suggestedServings: d.suggested_servings, basedOnCooks: d.based_on_cooks }
}
