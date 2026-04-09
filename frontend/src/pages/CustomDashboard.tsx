import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, RotateCcw, Save, X } from 'lucide-react'
import { useDevices } from '../hooks/useDevices'
import { useAlerts } from '../hooks/useAlerts'
import { devicesApi } from '../api/devices'

type WidgetKey =
  | 'device-status'
  | 'alerts'
  | 'device-count'
  | 'online-count'
  | 'recent-events'
  | 'uptime-leaderboard'

type LayoutItem = {
  widgetId: WidgetKey
  x: number
  y: number
  w: number
  h: number
}

const STORAGE_KEY = 'dtsys-dashboard-layout'
const availableWidgets: { id: WidgetKey; label: string }[] = [
  { id: 'device-status', label: 'Device Status Pie' },
  { id: 'alerts', label: 'Alert Summary' },
  { id: 'device-count', label: 'Device Count' },
  { id: 'online-count', label: 'Online Count' },
  { id: 'recent-events', label: 'Recent Events' },
  { id: 'uptime-leaderboard', label: 'Uptime Leaderboard' },
]
const defaultLayout: LayoutItem[] = [
  { widgetId: 'device-status', x: 1, y: 1, w: 4, h: 3 },
  { widgetId: 'alerts', x: 5, y: 1, w: 4, h: 3 },
  { widgetId: 'device-count', x: 9, y: 1, w: 2, h: 2 },
  { widgetId: 'online-count', x: 11, y: 1, w: 2, h: 2 },
  { widgetId: 'recent-events', x: 1, y: 4, w: 6, h: 4 },
  { widgetId: 'uptime-leaderboard', x: 7, y: 4, w: 6, h: 4 },
]

export default function CustomDashboard() {
  const { data: devices = [] } = useDevices()
  const { data: alerts = [] } = useAlerts({ resolved: false })
  const [editMode, setEditMode] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [layout, setLayout] = useState<LayoutItem[]>(() => readLayout())
  const [dragging, setDragging] = useState<WidgetKey | null>(null)
  const { data: recentDevices = [] } = useQuery({
    queryKey: ['devices', 'custom-dashboard'],
    queryFn: () => devicesApi.list(),
  })

  useEffect(() => {
    if (dragging == null) {
      return undefined
    }
    const handleUp = () => setDragging(null)
    window.addEventListener('mouseup', handleUp)
    return () => window.removeEventListener('mouseup', handleUp)
  }, [dragging])

  const onlineCount = devices.filter((device) => device.status === 'online').length
  const rendered = useMemo(() => layout.filter((item) => availableWidgets.some((widget) => widget.id === item.widgetId)), [layout])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">My Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">Compose your own operations view with reusable widgets.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEditMode((current) => !current)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700">{editMode ? 'Stop Editing' : 'Edit Layout'}</button>
          <button onClick={() => setShowPicker(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700"><Plus size={14} />Add Widget</button>
          <button onClick={() => { setLayout(defaultLayout); window.localStorage.removeItem(STORAGE_KEY) }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700"><RotateCcw size={14} />Reset</button>
          <button onClick={() => saveLayout(layout)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"><Save size={14} />Save Layout</button>
        </div>
      </div>

      <div className="grid auto-rows-[90px] grid-cols-12 gap-4">
        {rendered.map((item) => (
          <section
            key={item.widgetId}
            draggable={editMode}
            onDragStart={() => setDragging(item.widgetId)}
            onDragOver={(event) => {
              if (!editMode || !dragging || dragging === item.widgetId) return
              event.preventDefault()
            }}
            onDrop={() => {
              if (!editMode || !dragging || dragging === item.widgetId) return
              const from = layout.findIndex((entry) => entry.widgetId === dragging)
              const to = layout.findIndex((entry) => entry.widgetId === item.widgetId)
              const next = [...layout]
              const [moved] = next.splice(from, 1)
              next.splice(to, 0, moved)
              setLayout(next)
            }}
            className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            style={{ gridColumn: `span ${item.w}`, gridRow: `span ${item.h}` }}
          >
            {editMode && (
              <>
                <button onClick={() => setLayout((current) => current.filter((entry) => entry.widgetId !== item.widgetId))} className="absolute right-3 top-3 text-slate-400 hover:text-red-500"><X size={14} /></button>
                <button onClick={() => setLayout((current) => current.map((entry) => entry.widgetId === item.widgetId ? { ...entry, w: Math.min(12, entry.w + 1), h: Math.min(6, entry.h + 1) } : entry))} className="absolute bottom-3 right-3 rounded bg-slate-100 px-2 py-1 text-xs dark:bg-gray-800">Resize</button>
              </>
            )}
            <WidgetCard widgetId={item.widgetId} devices={recentDevices} alerts={alerts} onlineCount={onlineCount} />
          </section>
        ))}
      </div>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-gray-100">Add Widget</h2>
              <button onClick={() => setShowPicker(false)} className="text-sm text-slate-500 dark:text-gray-400">Close</button>
            </div>
            <div className="space-y-2">
              {availableWidgets.filter((widget) => !layout.some((entry) => entry.widgetId === widget.id)).map((widget) => (
                <button
                  key={widget.id}
                  onClick={() => {
                    setLayout((current) => [...current, { widgetId: widget.id, x: 1, y: current.length + 1, w: 4, h: 3 }])
                    setShowPicker(false)
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-left hover:border-blue-500 dark:border-gray-800"
                >
                  <span>{widget.label}</span>
                  <Plus size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WidgetCard({
  widgetId,
  devices,
  alerts,
  onlineCount,
}: {
  widgetId: WidgetKey
  devices: Awaited<ReturnType<typeof devicesApi.list>>
  alerts: { id: string; message: string; severity: string; alert_type: string }[]
  onlineCount: number
}) {
  if (widgetId === 'device-status') {
    const offline = devices.filter((device) => device.status === 'offline').length
    const alert = devices.filter((device) => device.status === 'alert').length
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">Device Status</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <StatBlock label="Online" value={onlineCount} tone="text-emerald-500" />
          <StatBlock label="Offline" value={offline} tone="text-slate-500" />
          <StatBlock label="Alert" value={alert} tone="text-red-500" />
        </div>
      </div>
    )
  }
  if (widgetId === 'alerts') {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">Last 5 Alerts</h3>
        {alerts.slice(0, 5).map((alert) => <p key={alert.id} className="text-sm text-slate-600 dark:text-gray-300">{alert.alert_type}: {alert.message}</p>)}
      </div>
    )
  }
  if (widgetId === 'device-count') {
    return <BigCount title="Total Devices" value={devices.length} />
  }
  if (widgetId === 'online-count') {
    return <BigCount title="Online Devices" value={onlineCount} />
  }
  if (widgetId === 'recent-events') {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">Recently Seen</h3>
        {devices.slice(0, 10).map((device) => <p key={device.id} className="text-sm text-slate-600 dark:text-gray-300">{device.label ?? device.hostname} · {device.status}</p>)}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">Uptime Leaderboard</h3>
      {devices.slice(0, 5).map((device) => <p key={device.id} className="text-sm text-slate-600 dark:text-gray-300">{device.label ?? device.hostname} · {device.status}</p>)}
    </div>
  )
}

function BigCount({ title, value }: { title: string; value: number }) {
  return (
    <div className="flex h-full flex-col justify-between">
      <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">{title}</p>
      <p className="text-4xl font-bold text-blue-500">{value}</p>
    </div>
  )
}

function StatBlock({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-gray-950/60">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  )
}

function readLayout(): LayoutItem[] {
  if (typeof window === 'undefined') {
    return defaultLayout
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return defaultLayout
  }
  try {
    return JSON.parse(raw) as LayoutItem[]
  } catch {
    return defaultLayout
  }
}

function saveLayout(layout: LayoutItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
}
