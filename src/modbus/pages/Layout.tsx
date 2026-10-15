import { Link, NavLink, Outlet } from 'react-router'
import { MODBUS_PAGES } from '../routes'

const NAV = MODBUS_PAGES.map(([path, label]) => [path ? `/modbus/${path}` : '/modbus', label] as const)

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="text-sm text-muted hover:text-accent">
            ← Tous les simulateurs
          </Link>
          <span className="font-semibold">TP2 · Liaison série / MODBUS</span>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) => `inline-flex min-h-10 items-center rounded-lg px-3 ${isActive ? 'bg-accent text-on-accent' : 'text-muted hover:bg-card-2'}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
