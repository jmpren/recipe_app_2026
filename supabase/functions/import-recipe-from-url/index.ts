// import-recipe-from-url (Edge Function)
//
// Fetches a URL, looks for a schema.org/Recipe in its JSON-LD, and returns the
// parsed fields. Falls back to { found: false } when there's no structured data
// or the page can't be read — the client always shows an editable form either
// way (PLAN.md §7). Lives here, not in the client, because it makes an outbound
// network call (PLAN.md §3), so every future client reuses it.
//
// Request:  POST { "url": string }
// Response: {
//   found: boolean,
//   title?: string, description?: string,
//   ingredients?: { quantity: number | null, unit: string | null, name: string, notes: string | null }[],
//   steps?: string[],
//   servings?: number | null,
//   image_url?: string | null
// }

import { clean, parseIngredient, type ParsedIngredient } from '../_shared/recipe-parse.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }

const FETCH_TIMEOUT_MS = 10_000
const MAX_HTML_BYTES = 3_000_000
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return true
  if (h === '0.0.0.0' || h === '::1' || h === '[::1]') return true
  if (/^127\./.test(h)) return true
  if (/^10\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (/^169\.254\./.test(h)) return true
  return false
}

function pickImage(v: unknown): string | null {
  if (!v) return null
  if (typeof v === 'string') return v
  if (Array.isArray(v)) {
    for (const item of v) {
      const found = pickImage(item)
      if (found) return found
    }
    return null
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.url === 'string') return o.url
  }
  return null
}

function pickServings(v: unknown): number | null {
  const candidates = Array.isArray(v) ? v : [v]
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return Math.round(c)
    if (typeof c === 'string') {
      const m = c.match(/\d+/)
      if (m) return parseInt(m[0], 10)
    }
  }
  return null
}

function pickSteps(v: unknown): string[] {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (!node) return
    if (typeof node === 'string') {
      node
        .split(/\r?\n+/)
        .map((s) => clean(s))
        .filter(Boolean)
        .forEach((s) => out.push(s))
      return
    }
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (typeof node === 'object') {
      const o = node as Record<string, unknown>
      const type = typeof o['@type'] === 'string' ? (o['@type'] as string).toLowerCase() : ''
      if (type === 'howtosection' && o.itemListElement) {
        walk(o.itemListElement)
        return
      }
      if (typeof o.text === 'string') {
        const t = clean(o.text)
        if (t) out.push(t)
        return
      }
      if (typeof o.name === 'string') {
        const t = clean(o.name)
        if (t) out.push(t)
      }
    }
  }
  walk(v)
  return out
}

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = []
  // Attribute order varies and minifiers drop the quotes, so match
  // `type = application/ld+json` with optional quotes and anything else in the tag.
  const re = /<script[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim().replace(/^<!--/, '').replace(/-->$/, '').trim()
    try {
      blocks.push(JSON.parse(raw))
    } catch {
      try {
        blocks.push(JSON.parse(raw.replace(/,\s*([\]}])/g, '$1')))
      } catch {
        // Not valid JSON — skip this block.
      }
    }
  }
  return blocks
}

function findRecipeNode(data: unknown): Record<string, unknown> | null {
  const stack: unknown[] = [data]
  while (stack.length) {
    const node = stack.pop()
    if (Array.isArray(node)) {
      stack.push(...node)
      continue
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      const t = obj['@type']
      const types = Array.isArray(t) ? t : [t]
      if (types.some((x) => typeof x === 'string' && x.toLowerCase() === 'recipe')) return obj
      if (obj['@graph']) stack.push(obj['@graph'])
    }
  }
  return null
}

interface ImportResult {
  found: boolean
  title?: string
  description?: string
  ingredients?: ParsedIngredient[]
  steps?: string[]
  servings?: number | null
  image_url?: string | null
}

function mapRecipe(node: Record<string, unknown>): ImportResult {
  const rawIngredients = (node.recipeIngredient ?? node.ingredients) as unknown
  const ingredientLines = Array.isArray(rawIngredients)
    ? rawIngredients.filter((x): x is string => typeof x === 'string')
    : typeof rawIngredients === 'string'
      ? [rawIngredients]
      : []

  const ingredients = ingredientLines
    .map(parseIngredient)
    .filter((x): x is ParsedIngredient => x !== null)

  const steps = pickSteps(node.recipeInstructions)

  const title = typeof node.name === 'string' ? clean(node.name) : undefined
  const description = typeof node.description === 'string' ? clean(node.description).slice(0, 2000) : undefined

  return {
    found: true,
    title,
    description: description || undefined,
    ingredients: ingredients.length ? ingredients : undefined,
    steps: steps.length ? steps : undefined,
    servings: pickServings(node.recipeYield),
    image_url: pickImage(node.image),
  }
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: JSON_HEADERS })
  }

  let url: string
  try {
    const body = await req.json()
    url = typeof body?.url === 'string' ? body.url.trim() : ''
  } catch {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: JSON_HEADERS })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_url' }), { status: 400, headers: JSON_HEADERS })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response(JSON.stringify({ error: 'invalid_url' }), { status: 400, headers: JSON_HEADERS })
  }
  if (isBlockedHost(parsed.hostname)) {
    return new Response(JSON.stringify({ error: 'blocked_host' }), { status: 400, headers: JSON_HEADERS })
  }

  const notFound = (): Response =>
    new Response(JSON.stringify({ found: false } satisfies ImportResult), { headers: JSON_HEADERS })

  let html: string
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
    })
    clearTimeout(timer)
    if (!res.ok) return notFound()
    const len = Number(res.headers.get('content-length') ?? '0')
    if (len && len > MAX_HTML_BYTES * 2) return notFound()
    html = (await res.text()).slice(0, MAX_HTML_BYTES)
  } catch {
    return notFound()
  }

  const node = extractJsonLd(html).map(findRecipeNode).find((n): n is Record<string, unknown> => n !== null)
  if (!node) return notFound()

  const result = mapRecipe(node)
  if (!result.title && !result.ingredients && !result.steps) return notFound()

  return new Response(JSON.stringify(result), { headers: JSON_HEADERS })
}

Deno.serve(handle)
