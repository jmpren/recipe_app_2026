import { useEffect } from 'react'

/**
 * Hold a screen wake lock while the component is mounted so the phone doesn't
 * dim mid-recipe. Re-acquires when the tab becomes visible again (the browser
 * drops the lock on tab switch / lock screen). No-ops where the API is missing
 * (older Safari, non-secure contexts) — cooking mode still works, the screen
 * just isn't kept awake.
 *
 * Device concern, not business logic — fine to live client-side (PLAN.md §3).
 */
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let released = false

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        // Denied (e.g. battery saver) or transient — nothing we can do; ignore.
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !released) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
    }
  }, [])
}
