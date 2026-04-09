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
  Camera,
  Activity,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { devicesApi } from '../api/devices'
import { groupsApi } from '../api/groups'
import { useDevice, useUpdateDevice } from '../hooks/useDevices'
import { useLatestMetric, useMetrics } from '../hooks/useMetrics'
import { useAuthStore } from '../store/authStore'
import DeviceStatusBadge from '../components/device/DeviceStatusBadge'
import MetricsChart from '../components/device/MetricsChart'
import SoftwareTable from '../components/device/SoftwareTable'
import EventLog from '../components/device/EventLog'
import CommandPanel from '../components/device/CommandPanel'
import NetworkInfo from '../components/device/NetworkInfo'
import ProcessList from '../components/device/ProcessList'
import { formatUptime, lastBootTime } from '../utils/time'
import { getTagColor } from '../utils/tags'

type Tab = 'overview' | 'software' | 'events' | 'commands' | 'network' | 'processes' | 'config'

const DEFAULT_DEVICE_CONFIG = {
  telemetry_interval_secs: 60,
  software_scan_interval_m: 60,
  event_poll_interval_secs: 120,
}

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { role } = useAuthStore()
  const [tab, setTab] = useState<Tab>('overview')
  const [copied, setCopied] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [configForm, setConfigForm] = useState(DEFAULT_DEVICE_CONFIG)
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureStartedAt, setCaptureStartedAt] = useState<number | null>(null)

  const { data: device, isLoading } = useDevice(id!)
  const updateDevice = useUpdateDevice(id!)
  const { data: metrics = [] } = useMetrics(id!, 24)
  const { data: latestMetric } = useLatestMetric(id!)
  const { data: configData } = useQuery({
    queryKey: ['device-config', id],
    queryFn: () => devicesApi.config(id!),
    enabled: Boolean(id),
  })
  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: groupsApi.list,
  })
  const { data: deviceGroups = [] } = useQuery({
    queryKey: ['device-groups', id],
    queryFn: () => groupsApi.deviceGroups(id!),
    enabled: Boolean(id),
  })
  const { data: screenshotData } = useQuery({
    queryKey: ['device-screenshot', id],
    queryFn: () => devicesApi.screenshot(id!),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: isCapturing ? 3000 : false,
  })
  const saveConfig = useMutation({
    mutationFn: () => devicesApi.updateConfig(id!, configForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-config', id] })
    },
  })
  const addToGroup = useMutation({
    mutationFn: () => groupsApi.addDevices(selectedGroupId, [id!]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-groups', id] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setSelectedGroupId('')
    },
  })
  const requestScreenshot = useMutation({
    mutationFn: () => devicesApi.requestScreenshot(id!),
    onSuccess: () => {
      setCaptureStartedAt(Date.now())
      setIsCapturing(true)
      queryClient.invalidateQueries({ queryKey: ['device-screenshot', id] })
    },
  })

  useEffect(() => {
    if (configData?.config) {
      setConfigForm(configData.config)
    }
  }, [configData])

  useEffect(() => {
    if (!isCapturing || !screenshotData?.captured_at) {
      return
    }

    const capturedAt = new Date(screenshotData.captured_at).getTime()
    if (!captureStartedAt || capturedAt >= captureStartedAt) {
      setIsCapturing(false)
    }
  }, [captureStartedAt, isCapturing, screenshotData])

  useEffect(() => {
    if (!isCapturing) {
      return undefined
    }

    const timeout = window.setTimeout(() => setIsCapturing(false), 30_000)
    return () => window.clearTimeout(timeout)
  }, [isCapturing])

  if (isLoading) return <div className="p-4 text-sm text-slate-500 dark:text-gray-500">Loading...</div>
  if (!device) return <div className="p-4 text-sm text-red-400">Device not found</div>

  const latest = latestMetric ?? metrics[0]
  const uptimeSecs = latest?.uptime_secs ?? null
  const bootTime = uptimeSecs != null ? lastBootTime(uptimeSecs) : null
  const availableGroups = groups.filter((group) => !deviceGroups.some((member) => member.id === group.id))

  const statCards = [
    { label: 'CPU', value: latest?.cpu_percent != null ? `${Math.round(latest.cpu_percent)}%` : '—', icon: Cpu, warning: (latest?.cpu_percent ?? 0) > 80 },
    { label: 'RAM', value: latest?.ram_percent != null ? `${Math.round(latest.ram_percent)}%` : '—', icon: MemoryStick, warning: (latest?.ram_percent ?? 0) > 80 },
    { label: 'Disk', value: latest?.disk_percent != null ? `${Math.round(latest.disk_percent)}%` : '—', icon: HardDrive, warning: (latest?.disk_percent ?? 0) > 85 },
    { label: 'Temp', value: latest?.cpu_temp != null ? `${Math.round(latest.cpu_temp)}°C` : '—', icon: Thermometer, warning: (latest?.cpu_temp ?? 0) > 80 },
    { label: 'Uptime', value: uptimeSecs != null ? formatUptime(uptimeSecs) : '—', icon: Clock3, warning: false },
    { label: 'Last Boot', value: bootTime ? formatDistanceToNow(bootTime, { addSuffix: true }) : '—', icon: History, warning: false },
  ]

  const tabs: Tab[] = ['overview', 'software', 'events', 'commands', 'network', 'processes', 'config']

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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
              <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 sm:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Groups</p>
                  {deviceGroups.map((group) => (
                    <span
                      key={group.id}
                      className="rounded-full px-2 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: group.color }}
                    >
                      {group.name}
                    </span>
                  ))}
                  {deviceGroups.length === 0 && <span className="text-sm text-slate-400">No groups assigned</span>}
                </div>
                {role === 'admin' && (
                  <div className="mt-3 flex gap-2">
                    <select
                      value={selectedGroupId}
                      onChange={(event) => setSelectedGroupId(event.target.value)}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                    >
                      <option value="">Add to group</option>
                      {availableGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => addToGroup.mutate()}
                      disabled={!selectedGroupId || addToGroup.isPending}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300">Live Screenshot</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">Screenshot requires user to be logged in on the device.</p>
              </div>
              <button
                onClick={() => requestScreenshot.mutate()}
                disabled={requestScreenshot.isPending || isCapturing}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <Camera size={14} />
                {isCapturing ? 'Capturing...' : 'Request Screenshot'}
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 dark:border-gray-700 dark:bg-gray-950/40">
              {screenshotData?.image_b64 ? (
                <img
                  src={`data:image/jpeg;base64,${screenshotData.image_b64}`}
                  alt={`Screenshot for ${device.hostname}`}
                  className="max-h-[28rem] w-full object-contain"
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-gray-500">
                  {isCapturing ? 'Capturing screenshot...' : 'No screenshot captured yet'}
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-gray-500">
              <span>
                {screenshotData?.captured_at
                  ? `Last captured ${formatDistanceToNow(new Date(screenshotData.captured_at), { addSuffix: true })}`
                  : 'No capture timestamp available'}
              </span>
              {screenshotData?.error && <span className="text-red-500">{screenshotData.error}</span>}
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

      {tab === 'processes' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Activity size={16} className="text-slate-500 dark:text-gray-500" />
            <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300">Top Processes</h3>
          </div>
          <ProcessList deviceId={id!} active={tab === 'processes'} />
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
