import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

export function Home() {
  const { user } = useAuth()

  return (
    <div className="rb-center">
      <div className="rb-card">
        <h1>Recipe Book</h1>
        <p className="rb-muted">
          Signed in as <strong>{user?.email}</strong>.
        </p>
        <p className="rb-muted">
          Phase&nbsp;0 is done: PWA scaffold, Supabase client, and magic-link auth
          are wired up. Phase&nbsp;1 (recipe list, add / edit, cooking mode, cook
          logs, riffs) starts here.
        </p>
        <button
          className="rb-button rb-button--ghost"
          onClick={() => void supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
