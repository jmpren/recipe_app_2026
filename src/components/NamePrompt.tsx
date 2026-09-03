import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../auth/useProfile'
import { displayNameIsPlaceholder } from '../lib/profile'

const DISMISS_KEY = 'rb-name-prompt-dismissed'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** One-time nudge for new accounts to set a display name. Non-blocking. */
export function NamePrompt() {
  const { user } = useAuth()
  const { profile, loading } = useProfile()
  const [dismissed, setDismissed] = useState(wasDismissed)

  if (loading || dismissed || !displayNameIsPlaceholder(profile, user?.email)) return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* fine — it just shows again next visit */
    }
    setDismissed(true)
  }

  return (
    <p className="rb-nudge rb-name-prompt">
      Welcome! Pick a display name so friends can tell it’s you.{' '}
      <Link to="/profile">Set it up</Link>
      <button type="button" className="rb-name-prompt__x" aria-label="Dismiss" onClick={dismiss}>
        ×
      </button>
    </p>
  )
}
