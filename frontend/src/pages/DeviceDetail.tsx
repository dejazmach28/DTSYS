import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Cpu,
  HardDrive,
  History,
  MemoryStick,
  Network,
  Plus,
  Thermometer,
  Wrench,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { devicesApi } from '../api/devices'
import { commandsApi } from '../api/commands'
import { groupsApi } from '../api/groups'
import { agentApi } from '../api/agent'
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
import { SkeletonMetric } from '../components/ui/Skeleton'
import { formatUptime, lastBootTime } from '../utils/time'
import { getTagColor } from '../utils/tags'

type Tab = 'overview' | 'software' | 'events' | 'commands' | 'network' | 'processes' | 'config'
type EventMode = 'system' | 'agent'

const DEFAULT_DEVICE_CONFIG = {
  telemetry_interval_secs: 60,
  software_scan_interval_m: 60,
  event_poll_interval_secs: 120,
}

const MOBILE_SECTIONS: Tab[] = ['overview', 'software', 'events', 'commands', 'network', 'processes', 'config']

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { role } = useAuthStore()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('overview')
  const [eventMode, setEventMode] = useState<EventMode>('system')
  const [copied, setCopied] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [configForm, setConfigForm] = useState(DEFAULT_DEVICE_CONFIG)
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureStartedAt, setCaptureStartedAt] = useState<number | null>(null)
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({ enabled: false, reason: '', until: '' })
  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldDraft, setFieldDraft] = useState('')
  const [openSections, setOpenSections] = useState<Record<Tab, boolean>>({
    overview: true,
    software: false,
    events: false,
    commands: false,
    network: false,
    processes: false,
    config: false,
  })

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
  const { data: uptimeHistory } = useQuery({
    queryKey: ['device-uptime-history', id],
    queryFn: () => devicesApi.uptimeHistory(id!),
    enabled: Boolean(id),
  })
  const { data: sshKeys = [] } = useQuery({
    queryKey: ['device-ssh-keys', id],
    queryFn: () => devicesApi.sshKeys(id!),
    enabled: Boolean(id),
  })
  const { data: agentVersion } = useQuery({
    queryKey: ['agent-version', device?.os_type, device?.arch],
    queryFn: () => agentApi.version(mapPlatform(device?.os_type), device?.arch ?? 'amd64'),
    enabled: Boolean(device),
  })

  const updateAvailable = Boolean(
    device?.agent_version &&
      agentVersion?.version &&
      compareSemver(agentVersion.version, device.agent_version) > 0
  )

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

  const updateAgent = useMutation({
    mutationFn: () => commandsApi.dispatch(id!, 'update', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commands', id] })
    },
  })
  const updateMaintenance = useMutation({
    mutationFn: () =>
      devicesApi.maintenance(id!, {
        enabled: maintenanceForm.enabled,
        reason: maintenanceForm.reason || null,
        until: maintenanceForm.until || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setMaintenanceOpen(false)
    },
  })
  const removeSSHKey = useMutation({
    mutationFn: (keyId: string) => devicesApi.deleteSSHKey(id!, keyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['device-ssh-keys', id] }),
  })

  useEffect(() => {
    if (configData?.config) {
      setConfigForm(configData.config)
    }
  }, [configData])

  useEffect(() => {
    setMaintenanceForm({
      enabled: Boolean(device?.maintenance_mode),
      reason: device?.maintenance_reason ?? '',
      until: device?.maintenance_until ? device.maintenance_until.slice(0, 16) : '',
    })
  }, [device?.maintenance_mode, device?.maintenance_reason, device?.maintenance_until])

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

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonMetric key={index} />
          ))}
        </div>
      </div>
    )
  }
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

  const overviewContent = (
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

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300">Uptime History (30d)</h3>
            <p className="text-xs text-slate-500 dark:text-gray-500">Recent outages and downtime trends.</p>
          </div>
          <div className={`text-2xl font-bold ${uptimeTone(uptimeHistory?.uptime_percent_30d ?? 100)}`}>
            {(uptimeHistory?.uptime_percent_30d ?? 100).toFixed(1)}% uptime
          </div>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }}>
          {buildUptimeSegments(uptimeHistory?.events ?? []).map((segment) => (
            <div
              key={segment.date}
              title={`${segment.date}: ${segment.label}`}
              className={`h-8 rounded-md ${segment.tone}`}
            />
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-gray-300">
          {(uptimeHistory?.outage_count ?? 0)} outages in last 30 days · Total downtime: {formatUptime(uptimeHistory?.total_downtime_secs ?? 0)}
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-white shadow-lg">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-200">System Info</h3>
          <div className="flex items-center gap-2">
            {updateAvailable && (
              <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-200">
                Update Available
              </span>
            )}
            <button
              onClick={() => updateAgent.mutate()}
              disabled={updateAgent.isPending}
              className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-blue-400 hover:text-white disabled:opacity-50"
            >
              Update Agent
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="OS" value={device.os_version ?? device.os_type} />
          <InfoRow label="Architecture" value={device.arch ?? '—'} />
          <InfoRow label="Hostname" value={device.hostname} />
          <InfoRow label="IP Address" value={device.ip_address ?? '—'} />
          <InfoRow label="Enrolled" value={format(new Date(device.enrolled_at), 'PPpp')} />
          <InfoRow label="Agent Version" value={device.agent_version ?? '—'} />
          <EditableInfoRow
            label="Serial Number"
            field="serial_number"
            value={device.serial_number ?? ''}
            editingField={editingField}
            draft={fieldDraft}
            setEditingField={setEditingField}
            setDraft={setFieldDraft}
            onSave={(value) => updateDevice.mutateAsync({ serial_number: value || null })}
          />
          <EditableInfoRow
            label="Manufacturer"
            field="manufacturer"
            value={device.manufacturer ?? ''}
            editingField={editingField}
            draft={fieldDraft}
            setEditingField={setEditingField}
            setDraft={setFieldDraft}
            onSave={(value) => updateDevice.mutateAsync({ manufacturer: value || null })}
          />
          <EditableInfoRow
            label="Model"
            field="model_name"
            value={device.model_name ?? ''}
            editingField={editingField}
            draft={fieldDraft}
            setEditingField={setEditingField}
            setDraft={setFieldDraft}
            onSave={(value) => updateDevice.mutateAsync({ model_name: value || null })}
          />
          <EditableInfoRow
            label="Location"
            field="location"
            value={device.location ?? ''}
            editingField={editingField}
            draft={fieldDraft}
            setEditingField={setEditingField}
            setDraft={setFieldDraft}
            onSave={(value) => updateDevice.mutateAsync({ location: value || null })}
          />
          <EditableInfoRow
            label="Assigned To"
            field="assigned_to"
            value={device.assigned_to ?? ''}
            editingField={editingField}
            draft={fieldDraft}
            setEditingField={setEditingField}
            setDraft={setFieldDraft}
            onSave={(value) => updateDevice.mutateAsync({ assigned_to: value || null })}
          />
          <EditableInfoRow
            label="Asset Tag"
            field="asset_tag"
            value={device.asset_tag ?? ''}
            editingField={editingField}
            draft={fieldDraft}
            setEditingField={setEditingField}
            setDraft={setFieldDraft}
            onSave={(value) => updateDevice.mutateAsync({ asset_tag: value || null })}
          />
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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
              {isCapturing ? 'Capturing screenshot...' : 'No screenshot yet — click Request Screenshot'}
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-gray-500">
          <span>
            {screenshotData?.captured_at
              ? `Last captured ${formatDistanceToNow(new Date(screenshotData.captured_at), { addSuffix: true })}`
              : isCapturing
                ? 'Waiting for capture...'
                : 'No capture yet'}
          </span>
          {screenshotData?.error && <span className="text-red-500">{screenshotData.error}</span>}
        </div>
      </div>
    </div>
  )

  const contentByTab: Record<Tab, ReactNode> = {
    overview: overviewContent,
    software: (
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-gray-300">Installed Software</h3>
        <SoftwareTable deviceId={id!} />
      </div>
    ),
    events: (
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300">Event Log</h3>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            {(['system', 'agent'] as EventMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setEventMode(mode)}
                className={`rounded-md px-3 py-1 text-xs capitalize ${eventMode === mode ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-gray-300'}`}
              >
                {mode === 'system' ? 'System Events' : 'Agent Logs'}
              </button>
            ))}
          </div>
        </div>
        <EventLog deviceId={id!} mode={eventMode} />
      </div>
    ),
    commands: (
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-gray-300">Remote Commands</h3>
        <CommandPanel deviceId={id!} />
      </div>
    ),
    network: (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Network size={16} className="text-slate-500 dark:text-gray-500" />
            <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300">Network Interfaces</h3>
          </div>
          <NetworkInfo deviceId={id!} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300">SSH Keys</h3>
            <p className="text-xs text-slate-500 dark:text-gray-500">Removing a key here does not remove it from the device.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500 dark:text-gray-500">
                <tr>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Fingerprint</th>
                  <th className="px-2 py-2">Comment</th>
                  <th className="px-2 py-2">Discovered</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {sshKeys.map((key) => (
                  <tr key={key.id} className="border-t border-slate-200 dark:border-gray-800">
                    <td className="px-2 py-2 text-slate-900 dark:text-gray-100">{key.key_type}</td>
                    <td className="px-2 py-2 font-mono text-xs text-slate-600 dark:text-gray-300">{key.fingerprint}</td>
                    <td className="px-2 py-2 text-slate-600 dark:text-gray-300">{key.comment ?? '—'}</td>
                    <td className="px-2 py-2 text-slate-600 dark:text-gray-300">{key.discovered_at ? formatDistanceToNow(new Date(key.discovered_at), { addSuffix: true }) : '—'}</td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => removeSSHKey.mutate(key.id)} className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 dark:border-red-500/30 dark:text-red-300">Remove from inventory</button>
                    </td>
                  </tr>
                ))}
                {sshKeys.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center text-slate-500 dark:text-gray-500">No SSH keys reported yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ),
    processes: (
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center gap-2">
          <Activity size={16} className="text-slate-500 dark:text-gray-500" />
          <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300">Top Processes</h3>
        </div>
        <ProcessList deviceId={id!} active={tab === 'processes' || isMobile} />
      </div>
    ),
    config: (
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
    ),
  }

  return (
    <div className="space-y-5">
      {device.maintenance_mode && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-300">
          🔧 Maintenance mode active
          {device.maintenance_reason ? ` · ${device.maintenance_reason}` : ''}
          {device.maintenance_until ? ` · until ${format(new Date(device.maintenance_until), 'PPpp')}` : ''}
        </div>
      )}
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
        <button
          onClick={() => setMaintenanceOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-400/40 px-3 py-2 text-sm text-amber-600 dark:text-amber-300"
        >
          <Wrench size={14} />
          Maintenance
        </button>
      </div>

      {isMobile ? (
        <div className="space-y-3">
          {MOBILE_SECTIONS.map((section) => (
            <section key={section} className="rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <button
                onClick={() => setOpenSections((current) => ({ ...current, [section]: !current[section] }))}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium capitalize text-slate-900 dark:text-gray-100"
              >
                <span>{section === 'events' ? 'Events & Logs' : section}</span>
                {openSections[section] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {openSections[section] && <div className="border-t border-slate-200 p-4 dark:border-gray-800">{contentByTab[section]}</div>}
            </section>
          ))}
        </div>
      ) : (
        <>
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

          {contentByTab[tab]}
        </>
      )}

      {maintenanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-gray-100">Maintenance Mode</h2>
              <button onClick={() => setMaintenanceOpen(false)} className="text-sm text-slate-500 dark:text-gray-400">Close</button>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={maintenanceForm.enabled}
                onChange={(event) => setMaintenanceForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
              Enable maintenance mode
            </label>
            <textarea
              value={maintenanceForm.reason}
              onChange={(event) => setMaintenanceForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Reason"
              rows={3}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
            <input
              type="datetime-local"
              value={maintenanceForm.until}
              onChange={(event) => setMaintenanceForm((current) => ({ ...current, until: event.target.value }))}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setMaintenanceOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700">Cancel</button>
              <button onClick={() => updateMaintenance.mutate()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">Save</button>
            </div>
          </div>
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

function EditableInfoRow({
  label,
  field,
  value,
  editingField,
  draft,
  setEditingField,
  setDraft,
  onSave,
}: {
  label: string
  field: string
  value: string
  editingField: string | null
  draft: string
  setEditingField: (field: string | null) => void
  setDraft: (value: string) => void
  onSave: (value: string) => Promise<unknown>
}) {
  const active = editingField === field

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      {active ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={async () => {
            await onSave(draft)
            setEditingField(null)
          }}
          onKeyDown={async (event) => {
            if (event.key === 'Enter') {
              await onSave(draft)
              setEditingField(null)
            }
          }}
          className="mt-1 w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none"
        />
      ) : (
        <button
          onClick={() => {
            setEditingField(field)
            setDraft(value)
          }}
          className="mt-1 text-left text-sm text-slate-100"
        >
          {value || '—'}
        </button>
      )}
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => (typeof window === 'undefined' ? false : window.innerWidth < 768))

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return isMobile
}

function uptimeTone(value: number) {
  if (value >= 99) return 'text-emerald-500'
  if (value >= 95) return 'text-amber-500'
  return 'text-red-500'
}

function mapPlatform(osType?: string) {
  if (!osType) return 'linux'
  const lower = osType.toLowerCase()
  if (lower.includes('windows')) return 'windows'
  if (lower.includes('darwin') || lower.includes('mac')) return 'darwin'
  return 'linux'
}

function compareSemver(a: string, b?: string | null) {
  if (!b) return 1
  const aParts = a.split('.').map((part) => Number(part))
  const bParts = b.split('.').map((part) => Number(part))
  for (let index = 0; index < 3; index += 1) {
    const aValue = aParts[index] ?? 0
    const bValue = bParts[index] ?? 0
    if (aValue > bValue) return 1
    if (aValue < bValue) return -1
  }
  return 0
}

function buildUptimeSegments(events: Array<{ event_type: string; timestamp: string; duration_secs: number | null }>) {
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - index))
    return { key: date.toISOString().slice(0, 10), downtime: 0 }
  })
  const map = new Map(days.map((entry) => [entry.key, entry]))
  for (const event of events) {
    const key = event.timestamp.slice(0, 10)
    const target = map.get(key)
    if (!target) continue
    if (event.event_type === 'online') {
      target.downtime += event.duration_secs ?? 0
    }
  }
  return days.map((entry) => {
    const uptime = Math.max(0, 86400 - entry.downtime)
    const uptimePercent = uptime / 86400
    return {
      date: entry.key,
      label: `${Math.round(uptimePercent * 100)}% uptime`,
      tone: uptimePercent >= 0.999 ? 'bg-emerald-500' : uptimePercent > 0 ? 'bg-amber-500' : 'bg-slate-300 dark:bg-gray-700',
    }
  })
}
