import { useEffect, useMemo, useRef, useState } from 'react'
import { Monitor, AlertTriangle, WifiOff, Wifi } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useDevices } from '../hooks/useDevices'
import { useAlerts } from '../hooks/useAlerts'
import { useActivityStream } from '../hooks/useActivityStream'
import DeviceCard from '../components/device/DeviceCard'
import BulkCommandBar from '../components/device/BulkCommandBar'
import { tagsApi } from '../api/tags'
import { groupsApi } from '../api/groups'
import { formatDistanceToNow } from 'date-fns'
import { exportToCSV } from '../utils/export'
import { SkeletonCard } from '../components/ui/Skeleton'

type Filter = 'all' | 'online' | 'offline' | 'alert'

export default function Dashboard() {
  const [searchParams] = useSearchParams()
  const [selectedTag, setSelectedTag] = useState('')
  const selectedGroupId = searchParams.get('group') ?? ''
  const { data: devices = [], isLoading: devicesLoading } = useDevices(selectedTag || undefined)
  const { data: alerts = [] } = useAlerts({ resolved: false })
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [paused, setPaused] = useState(false)
  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: tagsApi.list })
  const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
  const { data: groupDevices = [], isLoading: groupLoading } = useQuery({
    queryKey: ['groups', selectedGroupId, 'devices'],
    queryFn: () => groupsApi.devices(selectedGroupId),
    enabled: selectedGroupId.length > 0,
  })
  const activity = useActivityStream(true)
  const feedRef = useRef<HTMLDivElement | null>(null)

  const sourceDevices = selectedGroupId ? groupDevices : devices
  const isLoading = selectedGroupId ? groupLoading : devicesLoading

  const online = sourceDevices.filter((d) => d.status === 'online').length
  const offline = sourceDevices.filter((d) => d.status === 'offline').length
  const activeGroup = groups.find((group) => group.id === selectedGroupId)

  const filtered = sourceDevices
    .filter((d) => selectedTag === '' || (d.tags ?? []).includes(selectedTag))
    .filter((d) => filter === 'all' || d.status === filter)
    .filter((d) =>
      search === '' ||
      d.hostname.toLowerCase().includes(search.toLowerCase()) ||
      (d.label ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.ip_address ?? '').includes(search)
    )

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => sourceDevices.some((device) => device.id === id)))
  }, [sourceDevices])

  useEffect(() => {
    if (!paused && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [activity, paused])

  const toggleSelected = (deviceId: string) => {
    setSelectedIds((current) =>
      current.includes(deviceId)
        ? current.filter((id) => id !== deviceId)
        : [...current, deviceId]
    )
  }

  const stats = [
    { label: 'Total Devices', value: sourceDevices.length, icon: Monitor, color: 'text-blue-400' },
    { label: 'Online', value: online, icon: Wifi, color: 'text-green-400' },
    { label: 'Offline', value: offline, icon: WifiOff, color: 'text-gray-400' },
    { label: 'Active Alerts', value: alerts.length, icon: AlertTriangle, color: 'text-red-400' },
  ]

  const activityItems = useMemo(
    () =>
      activity.map((item, index) => ({
        ...item,
        key: `${item.device_id}-${item.time}-${index}`,
      })),
    [activity]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-500">Overview of all managed devices</p>
      </div>

      <button
        onClick={() =>
          exportToCSV(
            'devices.csv',
            ['ID', 'Hostname', 'OS', 'Status', 'Last Seen'],
            sourceDevices.map((device) => [
              device.id,
              device.label ?? device.hostname,
              device.os_version ?? device.os_type,
              device.status,
              device.last_seen ?? '',
            ])
          )
        }
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-gray-700 dark:text-gray-300"
      >
        Export CSV
      </button>

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

      {activeGroup && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          Filtering dashboard to group <span className="font-medium text-slate-900 dark:text-gray-100">{activeGroup.name}</span>.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-gray-600">
              <Monitor size={40} className="mx-auto mb-3 opacity-30" />
              <p>No devices found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-100">Live Activity</h2>
              <p className="text-xs text-slate-500 dark:text-gray-500">Last 20 events from all devices</p>
            </div>
            <button
              onClick={() => setPaused((current) => !current)}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 dark:border-gray-700 dark:text-gray-300"
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
          </div>
          <div ref={feedRef} className="h-[28rem] space-y-3 overflow-y-auto pr-1">
            {activityItems.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-gray-500">Waiting for activity...</p>
            ) : (
              activityItems.map((item) => (
                <div key={item.key} className="flex gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-gray-800">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${eventDot(item.event_type)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-gray-100">{item.device_hostname}</p>
                    <p className="text-xs text-slate-600 dark:text-gray-300">{item.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-gray-600">
                      {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {selectedIds.length >= 2 && (
        <BulkCommandBar
          selectedIds={selectedIds}
          onClear={() => setSelectedIds([])}
        />
      )}
    </div>
  )
}

function eventDot(eventType: string) {
  switch (eventType) {
    case 'crash':
      return 'bg-red-500'
    case 'error':
      return 'bg-rose-500'
    case 'warning':
      return 'bg-amber-500'
    default:
      return 'bg-blue-500'
  }
}
