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

export const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
}

/** A bare amount as a nice string: `1.5` → `1½`, `0.333` → `⅓`, else 2dp. */
export function formatQty(n: number): string {
  const whole = Math.floor(n)
  const frac = n - whole
  const near = FRACTIONS.find(([v]) => Math.abs(frac - v) < 0.02)
  if (near) return (whole > 0 ? String(whole) : '') + near[1]
  if (Math.abs(frac) < 0.02) return String(whole)
  return String(Math.round(n * 100) / 100)
}

/** Parse a bare amount: `1 1/2`, `1/2`, `1½`, `½`, `0.5`, `2`. */
export function parseQty(raw: string): number | null {
  const s = raw.trim().replace(',', '.')
  if (!s) return null

  const uni = s.match(/^(\d+)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/)
  if (uni) return (uni[1] ? parseInt(uni[1], 10) : 0) + (UNICODE_FRACTIONS[uni[2]] ?? 0)

  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10)

  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10)

  const dec = s.match(/^\d+(?:\.\d+)?$/)
  if (dec) return parseFloat(dec[0])

  return null
}

/** "1.5" + "cup" → "1½ cup"; "0.333" → "⅓"; leaves odd decimals as 2dp. */
export function formatAmount(quantity: number | null, unit: string | null): string {
  const u = unit ?? ''
  if (quantity == null) return u
  return [formatQty(quantity), u].join(' ').trim()
}
