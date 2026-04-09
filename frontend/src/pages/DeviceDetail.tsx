import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Thermometer,
  Clock3,
  History,
  Plus,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { devicesApi } from '../api/devices'
import { useDevice, useUpdateDevice } from '../hooks/useDevices'
import { useLatestMetric, useMetrics } from '../hooks/useMetrics'
import DeviceStatusBadge from '../components/device/DeviceStatusBadge'
import MetricsChart from '../components/device/MetricsChart'
import SoftwareTable from '../components/device/SoftwareTable'
import EventLog from '../components/device/EventLog'
import CommandPanel from '../components/device/CommandPanel'
import NetworkInfo from '../components/device/NetworkInfo'
import { formatUptime, lastBootTime } from '../utils/time'
import { getTagColor } from '../utils/tags'

type Tab = 'overview' | 'software' | 'events' | 'commands' | 'network' | 'config'

const DEFAULT_DEVICE_CONFIG = {
  telemetry_interval_secs: 60,
  software_scan_interval_m: 60,
  event_poll_interval_secs: 120,
}

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [copied, setCopied] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [configForm, setConfigForm] = useState(DEFAULT_DEVICE_CONFIG)

  const { data: device, isLoading } = useDevice(id!)
  const updateDevice = useUpdateDevice(id!)
  const { data: metrics = [] } = useMetrics(id!, 24)
  const { data: latestMetric } = useLatestMetric(id!)
  const { data: configData } = useQuery({
    queryKey: ['device-config', id],
    queryFn: () => devicesApi.config(id!),
    enabled: Boolean(id),
  })
  const saveConfig = useMutation({
    mutationFn: () => devicesApi.updateConfig(id!, configForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-config', id] })
    },
  })

  useEffect(() => {
    if (configData?.config) {
      setConfigForm(configData.config)
    }
  }, [configData])

  if (isLoading) return <div className="p-4 text-sm text-slate-500 dark:text-gray-500">Loading...</div>
  if (!device) return <div className="p-4 text-sm text-red-400">Device not found</div>

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

  const tabs: Tab[] = ['overview', 'software', 'events', 'commands', 'network', 'config']

  const copyDeviceID = async () => {
    await navigator.clipboard.writeText(device.id)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const addTag = async () => {
    const tag = newTag.trim()
    if (!tag) {
      return
    }
    const tags = Array.from(new Set([...(device.tags ?? []), tag]))
    await updateDevice.mutateAsync({ tags })
    setNewTag('')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-500 transition-colors hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">{device.label ?? device.hostname}</h1>
            <DeviceStatusBadge status={device.status} />
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-500">
            {device.hostname} · {device.os_version ?? device.os_type} · {device.ip_address ?? 'No IP'}
            {device.last_seen && ` · Last seen ${formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })}`}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-gray-800">
        {tabs.map((currentTab) => (
          <button
            key={currentTab}
            onClick={() => setTab(currentTab)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm capitalize transition-colors ${
              tab === currentTab
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-gray-300'
            }`}
          >
            {currentTab}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {statCards.map(({ label, value, icon: Icon, warning }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-gray-500">{label}</span>
                  <Icon size={14} className="text-slate-400 dark:text-gray-600" />
                </div>
                <span className={`text-2xl font-bold ${warning ? 'text-amber-400' : 'text-slate-900 dark:text-gray-100'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-gray-300">Last 24h Performance</h3>
            <MetricsChart metrics={metrics} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-white shadow-lg">
            <h3 className="mb-4 text-sm font-medium text-slate-200">System Info</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="OS" value={device.os_version ?? device.os_type} />
              <InfoRow label="Architecture" value={device.arch ?? '—'} />
              <InfoRow label="Hostname" value={device.hostname} />
              <InfoRow label="IP Address" value={device.ip_address ?? '—'} />
              <InfoRow label="Enrolled" value={format(new Date(device.enrolled_at), 'PPpp')} />
              <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Device ID</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 overflow-auto text-sm text-slate-100">{device.id}</code>
                  <button
                    onClick={copyDeviceID}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 transition-colors hover:border-blue-400 hover:text-white"
                  >
                    <Copy size={12} />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 sm:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Tags</p>
                  {(device.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getTagColor(tag)}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newTag}
                    onChange={(event) => setNewTag(event.target.value)}
                    placeholder="Add tag"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={addTag}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
                  >
                    <Plus size={14} />
                    Add Tag
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'software' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-gray-300">Installed Software</h3>
          <SoftwareTable deviceId={id!} />
        </div>
      )}

      {tab === 'events' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-gray-300">Event Log</h3>
          <EventLog deviceId={id!} />
        </div>
      )}

      {tab === 'commands' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-gray-300">Remote Commands</h3>
          <CommandPanel deviceId={id!} />
        </div>
      )}

      {tab === 'network' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Network size={16} className="text-slate-500 dark:text-gray-500" />
            <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300">Network Interfaces</h3>
          </div>
          <NetworkInfo deviceId={id!} />
        </div>
      )}

      {tab === 'config' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-medium text-slate-700 dark:text-gray-300">Agent Config</h3>
          {device.status === 'offline' && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
              Device is offline — config will apply on next connection.
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <NumberField
              label="Telemetry Interval (secs)"
              value={configForm.telemetry_interval_secs}
              onChange={(value) => setConfigForm((current) => ({ ...current, telemetry_interval_secs: value }))}
            />
            <NumberField
              label="Software Scan (mins)"
              value={configForm.software_scan_interval_m}
              onChange={(value) => setConfigForm((current) => ({ ...current, software_scan_interval_m: value }))}
            />
            <NumberField
              label="Event Poll (secs)"
              value={configForm.event_poll_interval_secs}
              onChange={(value) => setConfigForm((current) => ({ ...current, event_poll_interval_secs: value }))}
            />
          </div>
          <button
            onClick={() => saveConfig.mutate()}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
          >
            Save Config
          </button>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-100">{value}</p>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-slate-500 dark:text-gray-400">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
    </label>
  )
}
