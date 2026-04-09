import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, LogOut, Moon, Sun, User } from 'lucide-react'
import { useAlerts } from '../../hooks/useAlerts'
import { useSSE } from '../../hooks/useSSE'
import { useAlertStore } from '../../store/alertStore'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'

export default function Topbar() {
  const { username, role, logout } = useAuthStore()
  const { theme, toggle } = useThemeStore()
  const navigate = useNavigate()
  const { data: unresolvedAlerts = [] } = useAlerts({ resolved: false })
  const unresolved = useAlertStore((state) => state.unresolved)
  const setUnresolved = useAlertStore((state) => state.setUnresolved)

  useSSE(Boolean(username))

  useEffect(() => {
    setUnresolved(unresolvedAlerts)
  }, [setUnresolved, unresolvedAlerts])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="flex h-12 items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
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
      <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400">
        <User size={14} />
        <span className="text-slate-900 dark:text-gray-200">{username}</span>
        <span className="text-slate-400 dark:text-gray-600">({role})</span>
      </span>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <LogOut size={14} />
        Logout
      </button>
    </header>
  )
}
