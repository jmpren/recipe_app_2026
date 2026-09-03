import { supabase } from './supabase'

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealSlot = (typeof MEAL_SLOTS)[number]

export interface MealPlanEntry {
  id: string
  planned_on: string // 'YYYY-MM-DD'
  slot: MealSlot
  position: number
  recipe: { id: string; title: string; image_url: string | null }
}

/** Entries between two ISO dates (inclusive), ordered day → slot → position. */
export async function getPlan(startISO: string, endISO: string): Promise<MealPlanEntry[]> {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('id, planned_on, slot, position, recipe:recipes(id, title, image_url)')
    .gte('planned_on', startISO)
    .lte('planned_on', endISO)
    .order('planned_on')
    .order('slot')
    .order('position')

  if (error) throw error
  return (data ?? []) as unknown as MealPlanEntry[]
}

/** Add a recipe to a day. `user_id` + `position` are set server-side. */
export async function planMeal(
  recipeId: string,
  plannedOn: string,
  slot: MealSlot = 'dinner',
): Promise<void> {
  const { error } = await supabase.rpc('plan_meal', {
    recipe_id: recipeId,
    planned_on: plannedOn,
    slot,
  })
  if (error) throw error
}

export async function unplanMeal(entryId: string): Promise<void> {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .delete()
    .eq('id', entryId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('That plan entry is already gone.')
}
