import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Bell, Settings, Shield, BarChart2, Clock3 } from 'lucide-react'
import { useAlerts } from '../../hooks/useAlerts'
import { clsx } from 'clsx'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/scheduled', icon: Clock3, label: 'Scheduled' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const { data: alerts } = useAlerts({ resolved: false })
  const unresolvedCount = alerts?.length ?? 0

  return (
    <aside className="flex w-56 flex-col border-r border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-slate-200 p-4 dark:border-gray-800">
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
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
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

      <div className="border-t border-slate-200 p-3 text-xs text-slate-500 dark:border-gray-800 dark:text-gray-600">
        DTSYS v0.1.0
      </div>
    </aside>
  )
}
