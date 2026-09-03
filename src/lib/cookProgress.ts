// Cooking-mode tick-box progress, kept per recipe in localStorage so a reload or
// an accidental exit doesn't lose your place. Ephemeral UI state only — the
// durable record of a cook is a cook_logs row (see lib/cooks.ts).

const key = (recipeId: string) => `rb-cook:${recipeId}`

export function loadCookProgress(recipeId: string): string[] {
  try {
    const raw = localStorage.getItem(key(recipeId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveCookProgress(recipeId: string, stepIds: string[]) {
  try {
    localStorage.setItem(key(recipeId), JSON.stringify(stepIds))
  } catch {
    // Private mode / quota — progress just won't survive a reload.
  }
}

export function clearCookProgress(recipeId: string) {
  try {
    localStorage.removeItem(key(recipeId))
  } catch {
    // ignore
  }
}
