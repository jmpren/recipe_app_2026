// parse-recipe-text (Edge Function)
//
// Takes raw text (typically from on-device OCR of a photo) and splits it into a
// rough recipe: title + structured ingredients + steps. The client always shows
// an editable form, so "rough" is fine (same contract as import-recipe-from-url).
// The extraction (OCR / JSON-LD) is per-client; this shared heuristic is not
// (PLAN.md §3).
//
// Request:  POST { "text": string }
// Response: {
//   found: boolean,
//   title?: string,
//   ingredients?: { quantity: number | null, unit: string | null, name: string, notes: string | null }[],
//   steps?: string[]
// }

import { clean, parseIngredient, type ParsedIngredient } from '../_shared/recipe-parse.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }
const MAX_TEXT = 20_000

const ING_HEADER = /^\s*ingredients?\b/i
const STEP_HEADER = /^\s*(instructions?|directions?|method|steps?|preparation|to\s+make|to\s+serve)\b/i
const STEP_NUMBER = /^\s*(?:step\s*)?\d{1,2}\s*[.)\]:-]\s+/i
const BULLET = /^\s*[-*•‣·]\s+/
const AMOUNT_START = /^\s*(?:\d|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/

/** Drop OCR junk: page numbers, rules, stray single chars, urls. */
function isNoise(line: string): boolean {
  const t = line.trim()
  if (t.length < 2) return true
  if (/^[_\-–—=.*·•\s]+$/.test(t)) return true
  if (/^\d{1,3}$/.test(t)) return true
  if (/^(page|pg)\.?\s*\d+$/i.test(t)) return true
  if (/^(https?:\/\/|www\.)\S+$/i.test(t)) return true
  return false
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function cleanStep(line: string): string {
  return clean(line.replace(STEP_NUMBER, '').replace(BULLET, ''))
}

interface Result {
  found: boolean
  title?: string
  ingredients?: ParsedIngredient[]
  steps?: string[]
}

function parse(raw: string): Result {
  const lines = raw
    .split(/\r?\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0 && !isNoise(l))

  if (lines.length === 0) return { found: false }

  const idxIng = lines.findIndex((l) => ING_HEADER.test(l))
  const idxStep = lines.findIndex((l) => STEP_HEADER.test(l))

  let title = ''
  let ingredientLines: string[] = []
  let stepLines: string[] = []

  if (idxIng >= 0 && idxStep > idxIng) {
    title = lines.slice(0, idxIng).join(' ')
    ingredientLines = lines.slice(idxIng + 1, idxStep)
    stepLines = lines.slice(idxStep + 1)
  } else if (idxStep >= 0) {
    title = lines[0]
    ingredientLines = lines.slice(1, idxStep)
    stepLines = lines.slice(idxStep + 1)
  } else {
    // No headers — the ingredient block is the run of short/amount-y lines at
    // the top; the first long line or numbered step begins the method.
    title = lines[0]
    let splitAt = lines.length
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i]
      if (STEP_NUMBER.test(l) || (wordCount(l) >= 8 && !AMOUNT_START.test(l))) {
        splitAt = i
        break
      }
    }
    ingredientLines = lines.slice(1, splitAt)
    stepLines = lines.slice(splitAt)
  }

  const ingredients = ingredientLines
    .map(parseIngredient)
    .filter((x): x is ParsedIngredient => x !== null)

  const steps = stepLines
    .map(cleanStep)
    .filter((s) => s.length > 1 && !STEP_HEADER.test(s) && !ING_HEADER.test(s))

  const titleClean = clean(title).slice(0, 200)

  return {
    found: ingredients.length > 0 || steps.length > 0 || titleClean.length > 0,
    title: titleClean || undefined,
    ingredients: ingredients.length ? ingredients : undefined,
    steps: steps.length ? steps : undefined,
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    })
  }

  let text: string
  try {
    const body = await req.json()
    text = typeof body?.text === 'string' ? body.text.slice(0, MAX_TEXT) : ''
  } catch {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: JSON_HEADERS,
    })
  }

  if (!text.trim()) {
    return new Response(JSON.stringify({ found: false } satisfies Result), { headers: JSON_HEADERS })
  }

  return new Response(JSON.stringify(parse(text)), { headers: JSON_HEADERS })
})
