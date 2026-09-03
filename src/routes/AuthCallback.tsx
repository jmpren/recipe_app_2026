import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

function readAuthError(): string | null {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  return (
    hash.get('error_description') ??
    hash.get('error') ??
    query.get('error_description') ??
    query.get('error')
  )
}

/**
 * Landing page for the magic-link redirect. supabase-js parses the token from the
 * URL automatically (detectSessionInUrl); we just wait for the session to appear.
 */
export function AuthCallback() {
  const { session, loading } = useAuth()
  const error = readAuthError()

  if (error) {
    return (
      <div className="rb-center">
        <div className="rb-card">
          <h1>Sign-in failed</h1>
          <p className="rb-error">{error}</p>
          <Link className="rb-button rb-button--ghost" to="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  if (!loading && session) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="rb-center">
      <p className="rb-muted">Signing you in…</p>
    </div>
  )
}
