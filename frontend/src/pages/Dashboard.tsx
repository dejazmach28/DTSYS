import { useEffect, useState } from 'react'
import { Monitor, AlertTriangle, WifiOff, Wifi } from 'lucide-react'
import { useDevices } from '../hooks/useDevices'
import { useAlerts } from '../hooks/useAlerts'
import DeviceCard from '../components/device/DeviceCard'
import BulkCommandBar from '../components/device/BulkCommandBar'

type Filter = 'all' | 'online' | 'offline' | 'alert'

export default function Dashboard() {
  const { data: devices = [], isLoading } = useDevices()
  const { data: alerts = [] } = useAlerts({ resolved: false })
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

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
        <h1 className="text-xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of all managed devices</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{label}</span>
              <Icon size={15} className={color} />
            </div>
            <span className={`text-2xl font-bold ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          {(['all', 'online', 'offline', 'alert'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs capitalize transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hostname, IP..."
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-blue-600 transition-colors"
        />
      </div>

      {/* Device Grid */}
      {isLoading ? (
        <div className="text-gray-500 text-sm">Loading devices...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
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
