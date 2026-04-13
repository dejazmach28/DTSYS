import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, LogOut, Menu, Moon, Search, Sun, User } from 'lucide-react'
import { useAlerts } from '../../hooks/useAlerts'
import { useSSE } from '../../hooks/useSSE'
import { useAlertStore } from '../../store/alertStore'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { useGlobalSearchStore } from '../../store/globalSearchStore'
import { useLayoutStore } from '../../store/layoutStore'

export default function Topbar() {
  const { username, role, logout } = useAuthStore()
  const { theme, toggle } = useThemeStore()
  const openSearch = useGlobalSearchStore((state) => state.openSearch)
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar)
  const navigate = useNavigate()
  const { data: unresolvedAlerts = [] } = useAlerts({ resolved: false })
  const unresolved = useAlertStore((state) => state.unresolved)
  const setUnresolved = useAlertStore((state) => state.setUnresolved)

  useSSE(Boolean(username))

  const syncUnresolved = useCallback(
    (alerts: typeof unresolvedAlerts) => {
      setUnresolved(alerts)
    },
    [setUnresolved]
  )

  useEffect(() => {
    syncUnresolved(unresolvedAlerts)
  }, [syncUnresolved, unresolvedAlerts])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="flex h-12 items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>
        <button
          onClick={openSearch}
          className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:border-blue-300 hover:text-slate-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:border-blue-700 dark:hover:text-gray-100"
        >
          <Search size={14} />
          <span className="hidden flex-1 text-left sm:block">Search devices, software</span>
          <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] dark:border-gray-700">Ctrl K</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/alerts')}
          className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          title="Open alerts"
        >
          <Bell size={16} />
          {unresolved.length > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unresolved.length}
            </span>
          )}
        </button>
        <button
          onClick={toggle}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <span className="hidden items-center gap-1.5 text-sm text-slate-500 sm:flex dark:text-gray-400">
          <User size={14} />
          <span className="text-slate-900 dark:text-gray-200">{username}</span>
          <span className="text-slate-400 dark:text-gray-600">({role})</span>
        </span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
