import { Link, NavLink, Outlet } from 'react-router-dom'
import { useProfile } from '../auth/useProfile'

const TABS = [
  { to: '/', label: 'Home', end: true },
  { to: '/recipes', label: 'Recipe Book', end: false },
  { to: '/friends', label: 'Friends', end: false },
  { to: '/shopping', label: 'Shopping', end: false },
  { to: '/suggestions', label: 'Ideas', end: false },
]

export function AppLayout() {
  const { profile } = useProfile()
  // "@" ⇒ still the auto-assigned email; show a neutral label until they set a name.
  const accountLabel =
    !profile || profile.display_name.includes('@') ? 'Account' : profile.display_name

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
            <NavLink to="/profile" className="rb-button rb-button--ghost rb-account">
              {accountLabel}
            </NavLink>
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
