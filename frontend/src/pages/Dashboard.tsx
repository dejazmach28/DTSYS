import { useEffect, useState } from 'react'
import { Monitor, AlertTriangle, WifiOff, Wifi } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useDevices } from '../hooks/useDevices'
import { useAlerts } from '../hooks/useAlerts'
import DeviceCard from '../components/device/DeviceCard'
import BulkCommandBar from '../components/device/BulkCommandBar'
import { tagsApi } from '../api/tags'

type Filter = 'all' | 'online' | 'offline' | 'alert'

export default function Dashboard() {
  const [selectedTag, setSelectedTag] = useState('')
  const { data: devices = [], isLoading } = useDevices(selectedTag || undefined)
  const { data: alerts = [] } = useAlerts({ resolved: false })
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: tagsApi.list })

  const online = devices.filter((d) => d.status === 'online').length
  const offline = devices.filter((d) => d.status === 'offline').length

  const filtered = devices
    .filter((d) => filter === 'all' || d.status === filter)
    .filter((d) =>
      search === '' ||
      d.hostname.toLowerCase().includes(search.toLowerCase()) ||
      (d.label ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.ip_address ?? '').includes(search)
    )

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => devices.some((device) => device.id === id)))
  }, [devices])

  const toggleSelected = (deviceId: string) => {
    setSelectedIds((current) =>
      current.includes(deviceId)
        ? current.filter((id) => id !== deviceId)
        : [...current, deviceId]
    )
  }

  const stats = [
    { label: 'Total Devices', value: devices.length, icon: Monitor, color: 'text-blue-400' },
    { label: 'Online', value: online, icon: Wifi, color: 'text-green-400' },
    { label: 'Offline', value: offline, icon: WifiOff, color: 'text-gray-400' },
    { label: 'Active Alerts', value: alerts.length, icon: AlertTriangle, color: 'text-red-400' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-500">Overview of all managed devices</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-gray-500">{label}</span>
              <Icon size={15} className={color} />
            </div>
            <span className={`text-2xl font-bold ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
          {(['all', 'online', 'offline', 'alert'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs capitalize transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          value={selectedTag}
          onChange={(event) => setSelectedTag(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hostname, IP..."
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:placeholder-gray-600"
        />
      </div>

      {/* Device Grid */}
      {isLoading ? (
        <div className="text-sm text-slate-500 dark:text-gray-500">Loading devices...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-500 dark:text-gray-600">
          <Monitor size={40} className="mx-auto mb-3 opacity-30" />
          <p>No devices found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              selected={selectedIds.includes(device.id)}
              onToggleSelect={toggleSelected}
            />
          ))}
        </div>
      )}

      {selectedIds.length >= 2 && (
        <BulkCommandBar
          selectedIds={selectedIds}
          onClear={() => setSelectedIds([])}
        />
      )}
    </div>
  )
}
