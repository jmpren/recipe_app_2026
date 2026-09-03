import { supabase } from './supabase'

export interface Tag {
  id: string
  name: string
}

/** Every tag in the shared vocabulary, alphabetical. */
export async function listTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('id, name').order('name')
  if (error) throw error
  return data ?? []
}

/** recipe_id -> its tags, for the caller's recipes (RLS scopes recipe_tags). */
export async function getRecipeTagMap(): Promise<Map<string, Tag[]>> {
  const { data, error } = await supabase.from('recipe_tags').select('recipe_id, tag:tags(id, name)')
  if (error) throw error

  const map = new Map<string, Tag[]>()
  for (const row of (data ?? []) as unknown as { recipe_id: string; tag: Tag }[]) {
    const arr = map.get(row.recipe_id) ?? []
    arr.push(row.tag)
    map.set(row.recipe_id, arr)
  }
  for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name))
  return map
}

export async function getRecipeTags(recipeId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('recipe_tags')
    .select('tag:tags(id, name)')
    .eq('recipe_id', recipeId)
  if (error) throw error
  return ((data ?? []) as unknown as { tag: Tag }[])
    .map((r) => r.tag)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Find-or-create the tag and link it (idempotent). Returns the tag. */
export async function addRecipeTag(recipeId: string, name: string): Promise<Tag> {
  const { data, error } = await supabase.rpc('add_recipe_tag', {
    recipe_id: recipeId,
    tag_name: name,
  })
  if (error) throw error
  return data as Tag
}

export async function removeRecipeTag(recipeId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('recipe_tags')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('tag_id', tagId)
  if (error) throw error
}
