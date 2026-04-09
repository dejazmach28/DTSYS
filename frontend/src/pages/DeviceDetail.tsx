import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Cpu, HardDrive, MemoryStick, Network, Thermometer, Clock3, History } from 'lucide-react'
import { useDevice } from '../hooks/useDevices'
import { useLatestMetric, useMetrics } from '../hooks/useMetrics'
import DeviceStatusBadge from '../components/device/DeviceStatusBadge'
import MetricsChart from '../components/device/MetricsChart'
import SoftwareTable from '../components/device/SoftwareTable'
import EventLog from '../components/device/EventLog'
import CommandPanel from '../components/device/CommandPanel'
import NetworkInfo from '../components/device/NetworkInfo'
import { format, formatDistanceToNow } from 'date-fns'
import { formatUptime, lastBootTime } from '../utils/time'

type Tab = 'overview' | 'software' | 'events' | 'commands' | 'network'

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [copied, setCopied] = useState(false)

  const { data: device, isLoading } = useDevice(id!)
  const { data: metrics = [] } = useMetrics(id!, 24)
  const { data: latestMetric } = useLatestMetric(id!)

  if (isLoading) return <div className="text-gray-500 text-sm p-4">Loading...</div>
  if (!device) return <div className="text-red-400 text-sm p-4">Device not found</div>

  const latest = latestMetric ?? metrics[0]
  const uptimeSecs = latest?.uptime_secs ?? null
  const bootTime = uptimeSecs != null ? lastBootTime(uptimeSecs) : null

  const statCards = [
    { label: 'CPU', value: latest?.cpu_percent != null ? `${Math.round(latest.cpu_percent)}%` : '—', icon: Cpu, warning: (latest?.cpu_percent ?? 0) > 80 },
    { label: 'RAM', value: latest?.ram_percent != null ? `${Math.round(latest.ram_percent)}%` : '—', icon: MemoryStick, warning: (latest?.ram_percent ?? 0) > 80 },
    { label: 'Disk', value: latest?.disk_percent != null ? `${Math.round(latest.disk_percent)}%` : '—', icon: HardDrive, warning: (latest?.disk_percent ?? 0) > 85 },
    { label: 'Temp', value: latest?.cpu_temp != null ? `${Math.round(latest.cpu_temp)}°C` : '—', icon: Thermometer, warning: (latest?.cpu_temp ?? 0) > 80 },
    { label: 'Uptime', value: uptimeSecs != null ? formatUptime(uptimeSecs) : '—', icon: Clock3, warning: false },
    { label: 'Last Boot', value: bootTime ? formatDistanceToNow(bootTime, { addSuffix: true }) : '—', icon: History, warning: false },
  ]

  const tabs: Tab[] = ['overview', 'software', 'events', 'commands', 'network']

  const copyDeviceID = async () => {
    await navigator.clipboard.writeText(device.id)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-100">{device.label ?? device.hostname}</h1>
            <DeviceStatusBadge status={device.status} />
          </div>
          <p className="text-sm text-gray-500">
            {device.hostname} · {device.os_version ?? device.os_type} · {device.ip_address ?? 'No IP'}
            {device.last_seen && ` · Last seen ${formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Quick stats */}
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {statCards.map(({ label, value, icon: Icon, warning }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{label}</span>
                  <Icon size={14} className="text-gray-600" />
                </div>
                <span className={`text-2xl font-bold ${warning ? 'text-amber-400' : 'text-gray-100'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Metrics chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Last 24h Performance</h3>
            <MetricsChart metrics={metrics} />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="mb-4 text-sm font-medium text-gray-300">System Info</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="OS" value={device.os_version ?? device.os_type} />
              <InfoRow label="Architecture" value={device.arch ?? '—'} />
              <InfoRow label="Hostname" value={device.hostname} />
              <InfoRow label="IP Address" value={device.ip_address ?? '—'} />
              <InfoRow label="Enrolled" value={format(new Date(device.enrolled_at), 'PPpp')} />
              <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Device ID</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 overflow-auto text-sm text-gray-200">{device.id}</code>
                  <button
                    onClick={copyDeviceID}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300 transition-colors hover:border-blue-500 hover:text-white"
                  >
                    <Copy size={12} />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'software' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Installed Software</h3>
          <SoftwareTable deviceId={id!} />
        </div>
      )}

      {tab === 'events' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Event Log</h3>
          <EventLog deviceId={id!} />
        </div>
      )}

      {tab === 'commands' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Remote Commands</h3>
          <CommandPanel deviceId={id!} />
        </div>
      )}

      {tab === 'network' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <Network size={16} className="text-gray-500" />
            <h3 className="text-sm font-medium text-gray-300">Network Interfaces</h3>
          </div>
          <NetworkInfo deviceId={id!} />
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-200">{value}</p>
    </div>
  )
}
