import { Link, NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AppLayout() {
  return (
    <div className="rb-app">
      <header className="rb-header">
        <Link to="/" className="rb-brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Recipe Book</span>
        </Link>
        <nav className="rb-header-actions">
          <NavLink to="/plan" className="rb-button rb-button--ghost">
            Plan
          </NavLink>
          <NavLink to="/suggestions" className="rb-button rb-button--ghost">
            Suggestions
          </NavLink>
          <NavLink to="/recipes/new" className="rb-button">
            Add recipe
          </NavLink>
          <button
            type="button"
            className="rb-button rb-button--ghost"
            onClick={() => void supabase.auth.signOut()}
          >
            Sign out
          </button>
        </nav>
      </header>
      <main className="rb-main">
        <Outlet />
      </main>
    </div>
  )
}
