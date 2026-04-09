import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Monitor, Bell, Terminal, Settings, Shield } from 'lucide-react'
import { useAlerts } from '../../hooks/useAlerts'
import { clsx } from 'clsx'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const { data: alerts } = useAlerts({ resolved: false })
  const unresolvedCount = alerts?.length ?? 0

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800 flex items-center gap-2">
        <Shield className="text-blue-500" size={22} />
        <span className="font-bold text-lg tracking-tight">DTSYS</span>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              )
            }
          >
            <Icon size={16} />
            <span>{label}</span>
            {label === 'Alerts' && unresolvedCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {unresolvedCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-800 text-xs text-gray-600">
        DTSYS v0.1.0
      </div>
    </aside>
  )
}
