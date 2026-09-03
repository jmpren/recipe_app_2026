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
