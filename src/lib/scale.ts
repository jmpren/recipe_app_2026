import { formatQty, parseQty } from './units'

/**
 * Recipe scaling — including amounts written into step prose ("stir in 1/4 cup
 * sugar"). Pure functions, no framework: a Swift / React Native port is a direct
 * translation, so this is as reusable as an RPC would be. It lives client-side
 * (not in a Postgres / Edge function like the other calculations) because it has
 * to update live as the user drags the scaler, and rational-number tokenisation
 * of free text is impractical in plpgsql. Flagged here per PLAN.md §10 rule 7.
 */

export const SCALE_FACTORS = [0.5, 1, 1.5, 2, 3] as const

export function scaleFactorLabel(f: number): string {
  return `${formatQty(f)}×`
}

// Units after which a bare number is safe to scale. Deliberately measurement
// words only — never scale a number followed by "minutes", "°F", "inch", etc.
const SCALE_UNITS = new Set([
  'cup', 'cups',
  'tablespoon', 'tablespoons', 'tbsp', 'tbs', 'tbl',
  'teaspoon', 'teaspoons', 'tsp',
  'ounce', 'ounces', 'oz',
  'pound', 'pounds', 'lb', 'lbs',
  'gram', 'grams', 'g',
  'kilogram', 'kilograms', 'kg',
  'ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres',
  'liter', 'liters', 'litre', 'litres', 'l',
  'pinch', 'pinches', 'clove', 'cloves', 'can', 'cans',
  'stick', 'sticks', 'slice', 'slices', 'sprig', 'sprigs',
])

// group 1: the amount   group 2: gap before the word   group 3: the word
const AMOUNT_RE =
  /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?\s*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\d+(?:\.\d+)?)(\s*)([A-Za-z]+)/g

export interface ScaleSegment {
  text: string
  scaled: boolean
}

/** Split step text into segments, rescaling amounts that are followed by a
 *  known measurement unit. `changed` is false when nothing was touched. */
export function scaleStepText(text: string, factor: number): {
  segments: ScaleSegment[]
  changed: boolean
} {
  if (factor === 1) return { segments: [{ text, scaled: false }], changed: false }

  const segments: ScaleSegment[] = []
  let cursor = 0
  let changed = false

  for (const m of text.matchAll(AMOUNT_RE)) {
    const [full, amount, gap, word] = m
    const at = m.index ?? 0
    if (!SCALE_UNITS.has(word.toLowerCase())) continue
    const value = parseQty(amount)
    if (value == null) continue

    if (at > cursor) segments.push({ text: text.slice(cursor, at), scaled: false })
    segments.push({ text: `${formatQty(value * factor)}${gap}${word}`, scaled: true })
    cursor = at + full.length
    changed = true
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), scaled: false })
  if (segments.length === 0) segments.push({ text, scaled: false })
  return { segments, changed }
}
