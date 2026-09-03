import { supabase } from './supabase'

export type UnitSystem = 'original' | 'metric' | 'imperial'

export interface ConvertedAmount {
  quantity: number | null
  unit: string | null
  /** false when the unit wasn't recognised — the original amount is echoed back. */
  converted: boolean
}

/**
 * Convert a list of `{ quantity, unit }` to `target` via the `convert_measurements`
 * RPC. Conversion factors + rounding live in the DB so every client agrees
 * (PLAN.md §3); this is display-only, the stored recipe is untouched. Order is
 * preserved, so results line up with the input by index.
 */
export async function convertAmounts(
  items: { quantity: number | null; unit: string | null }[],
  target: Exclude<UnitSystem, 'original'>,
): Promise<ConvertedAmount[]> {
  const { data, error } = await supabase.rpc('convert_measurements', {
    items: items.map((i) => ({ quantity: i.quantity, unit: i.unit })),
    target,
  })
  if (error) throw error
  return (data as ConvertedAmount[] | null) ?? []
}

const FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
]

/** "1.5" + "cup" → "1½ cup"; "0.333" → "⅓"; leaves odd decimals as 2dp. */
export function formatAmount(quantity: number | null, unit: string | null): string {
  const u = unit ?? ''
  if (quantity == null) return u

  const whole = Math.floor(quantity)
  const frac = quantity - whole
  const near = FRACTIONS.find(([v]) => Math.abs(frac - v) < 0.02)

  let q: string
  if (near) q = (whole > 0 ? String(whole) : '') + near[1]
  else if (Math.abs(frac) < 0.02) q = String(whole)
  else q = String(Math.round(quantity * 100) / 100)

  return [q, u].join(' ').trim()
}
