// Shared recipe-text parsing for the Edge Functions (import-recipe-from-url,
// parse-recipe-text). Pure string work — the reusable half of "turn some text
// into a recipe" (PLAN.md §3). Each client does its own extraction (JSON-LD /
// OCR) then hands the text here.

export const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4,
  '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
}

export const UNITS = new Set([
  'cup', 'cups', 'c',
  'tablespoon', 'tablespoons', 'tbsp', 'tbs', 'tbl',
  'teaspoon', 'teaspoons', 'tsp',
  'ounce', 'ounces', 'oz',
  'pound', 'pounds', 'lb', 'lbs',
  'gram', 'grams', 'g',
  'kilogram', 'kilograms', 'kg',
  'milliliter', 'milliliters', 'ml',
  'liter', 'liters', 'litre', 'litres', 'l',
  'pinch', 'pinches', 'dash', 'dashes', 'handful', 'handfuls',
  'clove', 'cloves', 'can', 'cans', 'jar', 'jars',
  'package', 'packages', 'pkg', 'packet', 'packets',
  'slice', 'slices', 'stick', 'sticks', 'sprig', 'sprigs',
  'bunch', 'bunches', 'head', 'heads', 'stalk', 'stalks',
  'quart', 'quarts', 'qt', 'pint', 'pints', 'pt', 'gallon', 'gallons', 'gal',
])

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
}

export function clean(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function parseQuantity(raw: string): number | null {
  const s = raw.trim().replace(',', '.')
  if (!s) return null

  const uni = s.match(/^(\d+)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/)
  if (uni) {
    const whole = uni[1] ? parseInt(uni[1], 10) : 0
    return round(whole + (UNICODE_FRACTIONS[uni[2]] ?? 0))
  }
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) return round(parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10))
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (frac) return round(parseInt(frac[1], 10) / parseInt(frac[2], 10))
  const dec = s.match(/^\d+(?:\.\d+)?$/)
  if (dec) return round(parseFloat(dec[0]))
  return null
}

export interface ParsedIngredient {
  quantity: number | null
  unit: string | null
  name: string
  notes: string | null
}

export function parseIngredient(line: string): ParsedIngredient | null {
  const text = clean(line)
  if (!text) return null

  let rest = text
  let notes: string | null = null
  const comma = rest.indexOf(',')
  if (comma !== -1) {
    notes = rest.slice(comma + 1).trim() || null
    rest = rest.slice(0, comma).trim()
  }

  // Leading amount: digits / fractions / unicode fractions, optionally a range
  // ("2-3", "2 to 3") — take the first value.
  const qtyMatch = rest.match(
    /^(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+\s*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\d+(?:\.\d+)?)/,
  )
  let quantity: number | null = null
  if (qtyMatch) {
    quantity = parseQuantity(qtyMatch[0])
    rest = rest.slice(qtyMatch[0].length).trim()
    rest = rest.replace(/^(?:-|–|to)\s*[\d./½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+\s*/i, '') // drop "- 3" of a range
  }

  let unit: string | null = null
  const spaceIdx = rest.indexOf(' ')
  const firstToken = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toLowerCase().replace(/\.$/, '')
  if (UNITS.has(firstToken)) {
    unit = firstToken
    rest = spaceIdx === -1 ? '' : rest.slice(spaceIdx).trim()
  }

  const name = rest || (notes ? `${text.slice(0, comma)}`.trim() : text)
  return { quantity, unit, name: name || text, notes }
}
