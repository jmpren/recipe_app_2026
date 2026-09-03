import { emptyDraft } from './draft'
import { supabase } from './supabase'
import type { RecipeDraft } from '../types'

interface ImportResult {
  found: boolean
  title?: string
  description?: string
  ingredients?: { quantity: number | null; unit: string | null; name: string; notes: string | null }[]
  steps?: string[]
  servings?: number | null
  image_url?: string | null
}

export interface ImportOutcome {
  draft: RecipeDraft
  /** true when the page had a usable schema.org Recipe. */
  found: boolean
  /** Cover image URL from the source page, if any (not uploaded to our bucket). */
  imageUrl: string | null
}

/**
 * Ask the import-recipe-from-url Edge Function to read a URL and pre-fill a
 * draft. Never throws — a fetch/parse failure just yields a blank draft with the
 * URL kept as the source, so the caller can always drop the user into the form
 * (PLAN.md §7). The extraction itself lives in the Edge Function, not here
 * (PLAN.md §3).
 */
export async function importRecipeFromUrl(url: string): Promise<ImportOutcome> {
  const draft = emptyDraft()
  draft.source_url = url
  try {
    draft.source_name = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    // Not a parseable URL — the Edge Function will reject it; leave source_name blank.
  }

  let result: ImportResult = { found: false }
  try {
    const { data, error } = await supabase.functions.invoke<ImportResult>('import-recipe-from-url', {
      body: { url },
    })
    if (error) throw error
    if (data) result = data
  } catch (e) {
    console.error('recipe import failed', e)
  }

  if (result.found) {
    if (result.title) draft.title = result.title
    if (result.description) draft.description = result.description
    if (result.servings != null) draft.servings = String(result.servings)
    if (result.ingredients?.length) {
      draft.ingredients = result.ingredients.map((i) => ({
        quantity: i.quantity != null ? String(i.quantity) : '',
        unit: i.unit ?? '',
        name: i.name,
        notes: i.notes ?? '',
      }))
    }
    if (result.steps?.length) {
      draft.steps = result.steps.map((s) => ({ instruction: s }))
    }
  }

  return { draft, found: result.found, imageUrl: result.image_url ?? null }
}
