import { supabase } from './supabase'

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealSlot = (typeof MEAL_SLOTS)[number]

export interface MealPlanEntry {
  id: string
  planned_on: string // 'YYYY-MM-DD'
  slot: MealSlot
  position: number
  recipe: { id: string; title: string; image_url: string | null }
  /** For a household plan: who added it. null on personal entries. */
  addedByName: string | null
}

interface Row {
  id: string
  planned_on: string
  slot: MealSlot
  position: number
  recipe: { id: string; title: string; image_url: string | null }
  adder: { display_name: string } | null
}

const SELECT =
  'id, planned_on, slot, position, recipe:recipes(id, title, image_url), ' +
  'adder:profiles!meal_plan_entries_user_id_fkey(display_name)'

function map(rows: Row[]): MealPlanEntry[] {
  return rows.map((r) => ({
    id: r.id,
    planned_on: r.planned_on,
    slot: r.slot,
    position: r.position,
    recipe: r.recipe,
    addedByName: r.adder?.display_name ?? null,
  }))
}

/** Your personal plan for a date range (household entries excluded). */
export async function getPlan(startISO: string, endISO: string): Promise<MealPlanEntry[]> {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select(SELECT)
    .is('household_id', null)
    .gte('planned_on', startISO)
    .lte('planned_on', endISO)
    .order('planned_on')
    .order('slot')
    .order('position')
  if (error) throw error
  return map((data ?? []) as unknown as Row[])
}

/** A household's shared plan for a date range. */
export async function getHouseholdPlan(
  householdId: string,
  startISO: string,
  endISO: string,
): Promise<MealPlanEntry[]> {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select(SELECT)
    .eq('household_id', householdId)
    .gte('planned_on', startISO)
    .lte('planned_on', endISO)
    .order('planned_on')
    .order('slot')
    .order('position')
  if (error) throw error
  return map((data ?? []) as unknown as Row[])
}

/** Add a recipe to a day. `user_id` + `position` are set server-side.
 *  `householdId` set → adds to that household's shared plan. */
export async function planMeal(
  recipeId: string,
  plannedOn: string,
  slot: MealSlot = 'dinner',
  householdId?: string,
): Promise<void> {
  const { error } = await supabase.rpc('plan_meal', {
    recipe_id: recipeId,
    planned_on: plannedOn,
    slot,
    household_id: householdId ?? undefined,
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
