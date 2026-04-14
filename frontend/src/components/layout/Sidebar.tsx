import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Bell, Settings, Shield, BarChart2, Building2, CheckSquare, ClipboardList, Clock3, PackageOpen, Plus, Network, BookOpen, Package, Users, Monitor } from 'lucide-react'
import { useAlerts } from '../../hooks/useAlerts'
import { clsx } from 'clsx'
import { groupsApi } from '../../api/groups'
import { useAuthStore } from '../../store/authStore'

const navItems = [
  { to: '/my-dashboard', icon: LayoutDashboard, label: 'My Dashboard' },
  { to: '/', icon: Monitor, label: 'Devices' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/network-map', icon: Network, label: 'Network Map' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/command-library', icon: BookOpen, label: 'Command Library' },
  { to: '/software-updates', icon: PackageOpen, label: 'Software Updates' },
  { to: '/scheduled', icon: Clock3, label: 'Scheduled' },
  { to: '/compliance', icon: CheckSquare, label: 'Compliance' },
  { to: '/audit', icon: ClipboardList, label: 'Audit Log', adminOnly: true },
  { to: '/users', icon: Users, label: 'Users', adminOnly: true },
  { to: '/organizations', icon: Building2, label: 'Organizations' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { role } = useAuthStore()
  const { data: alerts } = useAlerts({ resolved: false })
  const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupForm, setGroupForm] = useState({ name: '', color: '#3b82f6' })
  const unresolvedCount = alerts?.length ?? 0
  const activeGroupId = new URLSearchParams(location.search).get('group')

  const createGroup = useMutation({
    mutationFn: () => groupsApi.create({ name: groupForm.name, color: groupForm.color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setGroupForm({ name: '', color: '#3b82f6' })
      setShowCreateGroup(false)
    },
  })

  return (
    <aside className={clsx('flex w-56 flex-col border-r border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900', className)}>
      <div className="flex items-center gap-2 border-b border-slate-200 p-4 dark:border-gray-800">
        <Shield className="text-blue-500" size={22} />
        <span className="font-bold text-lg tracking-tight">DTSYS</span>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.filter((item) => !item.adminOnly || role === 'admin').map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
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

        <div className="mt-4 px-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-600">Groups</span>
            {role === 'admin' && (
              <button
                onClick={() => setShowCreateGroup(true)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                title="Create group"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
          <div className="space-y-1">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  navigate(group.id === activeGroupId ? '/' : `/?group=${group.id}`)
                  onNavigate?.()
                }}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors',
                  group.id === activeGroupId
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                <span className="min-w-0 flex-1 truncate">{group.name}</span>
                <span className="text-xs text-slate-400 dark:text-gray-600">{group.member_count ?? 0}</span>
              </button>
            ))}
            {groups.length === 0 && (
              <p className="px-2 py-1 text-xs text-slate-400 dark:text-gray-600">No groups yet</p>
            )}
          </div>
        </div>
      </nav>

      <div className="border-t border-slate-200 p-3 text-xs text-slate-500 dark:border-gray-800 dark:text-gray-600">
        DTSYS v0.1.0
      </div>

      {showCreateGroup && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">Create Group</h3>
            <div className="mt-4 space-y-3">
              <input
                value={groupForm.name}
                onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Group name"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-gray-300">
                <span>Color</span>
                <input
                  type="color"
                  value={groupForm.color}
                  onChange={(event) => setGroupForm((current) => ({ ...current, color: event.target.value }))}
                  className="h-10 w-14 rounded border border-slate-200 bg-transparent dark:border-gray-700"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateGroup(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => createGroup.mutate()}
                disabled={!groupForm.name.trim() || createGroup.isPending}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
