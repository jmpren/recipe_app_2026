/** Local-time date helpers for the meal calendar. `toISODate` avoids the UTC
 *  shift you'd get from `Date.prototype.toISOString()`. */

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Monday of the week containing `d`, at local midnight. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const mondayOffset = (x.getDay() + 6) % 7 // Sun=0 → 6, Mon=1 → 0, …
  x.setDate(x.getDate() - mondayOffset)
  return x
}

export function today(): Date {
  const x = new Date()
  x.setHours(0, 0, 0, 0)
  return x
}
