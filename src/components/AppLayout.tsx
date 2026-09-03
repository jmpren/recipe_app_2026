import { Link, NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TABS = [
  { to: '/', label: 'Home', end: true },
  { to: '/recipes', label: 'Recipe Book', end: false },
  { to: '/shopping', label: 'Shopping', end: false },
  { to: '/suggestions', label: 'Ideas', end: false },
]

export function AppLayout() {
  return (
    <div className="rb-app">
      <div className="rb-topbar">
        <header className="rb-header">
          <Link to="/" className="rb-brand" aria-label="Home">
            <img src="/favicon.svg" alt="" width={28} height={28} />
          </Link>
          <div className="rb-header-actions">
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
          </div>
        </header>

        <nav className="rb-tabs" aria-label="Primary">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => `rb-tab${isActive ? ' is-active' : ''}`}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="rb-main">
        <Outlet />
      </main>
    </div>
  )
}
