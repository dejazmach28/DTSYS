import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import api from '../api/client'
import { devicesApi } from '../api/devices'
import { metricsApi } from '../api/metrics'
import { formatUptime } from '../utils/time'
import type { Alert, Device, SoftwarePackage } from '../types'
import DeviceStatusBadge from '../components/device/DeviceStatusBadge'

const metricColor = (value: number | null | undefined, warning = 80, danger = 90) => {
  if (value == null) return 'text-slate-400 dark:text-gray-500'
  if (value >= danger) return 'text-red-500'
  if (value >= warning) return 'text-amber-500'
  return 'text-emerald-500'
}

export default function DeviceCompare() {
  const [searchParams] = useSearchParams()
  const [highlightDiffs, setHighlightDiffs] = useState(true)
  const ids = useMemo(
    () =>
      (searchParams.get('ids') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 4),
    [searchParams],
  )

  const deviceQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['device', 'compare', id],
      queryFn: () => devicesApi.get(id),
      enabled: ids.length > 0,
    })),
  })

  const alertQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['alerts', 'compare', id],
      queryFn: () => api.get<Alert[]>('/alerts', { params: { device_id: id, resolved: false, limit: 200 } }).then((r) => r.data),
      enabled: ids.length > 0,
    })),
  })

  const metricQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['metrics', 'compare', id, 'latest'],
      queryFn: () => metricsApi.latest(id),
      enabled: ids.length > 0,
    })),
  })

  const softwareQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['software', 'compare', id],
      queryFn: () => api.get<SoftwarePackage[]>(`/devices/${id}/software`).then((r) => r.data),
      enabled: ids.length > 0,
    })),
  })

  const compareRows = ids
    .map((_, index) => {
      const device = deviceQueries[index]?.data as Device | undefined
      if (!device) {
        return null
      }
      const latestMetric = metricQueries[index]?.data
      const alerts = alertQueries[index]?.data ?? []
      const software = softwareQueries[index]?.data ?? []
      const pendingUpdates = software.filter((entry) => entry.update_available).length

      return {
        device,
        latestMetric,
        alerts,
        softwareCount: software.length,
        pendingUpdates,
      }
    })
    .filter(Boolean) as Array<{
      device: Device
      latestMetric: Awaited<ReturnType<typeof metricsApi.latest>> | undefined
      alerts: Alert[]
      softwareCount: number
      pendingUpdates: number
    }>

  if (ids.length < 2) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
        Select 2 to 4 devices from the dashboard and use Compare to open this view.
      </div>
    )
  }

  const valuesByField = {
    os: new Set(compareRows.map((row) => row.device.os_version ?? row.device.os_type)).size,
    uptime: new Set(compareRows.map((row) => row.latestMetric?.uptime_secs ?? 0)).size,
    alertCount: new Set(compareRows.map((row) => row.alerts.length)).size,
    softwareCount: new Set(compareRows.map((row) => row.softwareCount)).size,
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Device Compare</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-500">Side-by-side comparison for up to four devices.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={highlightDiffs}
            onChange={(event) => setHighlightDiffs(event.target.checked)}
            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-900"
          />
          Difference highlight
        </label>
      </div>

      <div className={`grid gap-4 ${ids.length === 2 ? 'lg:grid-cols-2' : ids.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
        {compareRows.map((row) => (
          <article key={row.device.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-gray-100">{row.device.label ?? row.device.hostname}</h2>
                <p className="text-sm text-slate-500 dark:text-gray-500">{row.device.hostname}</p>
              </div>
              <DeviceStatusBadge status={row.device.status} size="sm" />
            </div>

            <div className="space-y-3 text-sm">
              <CompareCell
                label="CPU"
                value={row.latestMetric?.cpu_percent != null ? `${row.latestMetric.cpu_percent.toFixed(1)}%` : '—'}
                highlight={highlightDiffs && compareRows.some((entry) => Math.abs((entry.latestMetric?.cpu_percent ?? 0) - (row.latestMetric?.cpu_percent ?? 0)) >= 10)}
                valueClassName={metricColor(row.latestMetric?.cpu_percent, 70, 90)}
              />
              <CompareCell
                label="RAM"
                value={row.latestMetric?.ram_percent != null ? `${row.latestMetric.ram_percent.toFixed(1)}%` : '—'}
                highlight={highlightDiffs && compareRows.some((entry) => Math.abs((entry.latestMetric?.ram_percent ?? 0) - (row.latestMetric?.ram_percent ?? 0)) >= 10)}
                valueClassName={metricColor(row.latestMetric?.ram_percent, 70, 90)}
              />
              <CompareCell
                label="Disk"
                value={row.latestMetric?.disk_percent != null ? `${row.latestMetric.disk_percent.toFixed(1)}%` : '—'}
                highlight={highlightDiffs && compareRows.some((entry) => Math.abs((entry.latestMetric?.disk_percent ?? 0) - (row.latestMetric?.disk_percent ?? 0)) >= 10)}
                valueClassName={metricColor(row.latestMetric?.disk_percent, 75, 90)}
              />
              <CompareCell
                label="Temp"
                value={row.latestMetric?.cpu_temp != null ? `${row.latestMetric.cpu_temp.toFixed(1)}°C` : '—'}
                highlight={highlightDiffs && compareRows.some((entry) => Math.abs((entry.latestMetric?.cpu_temp ?? 0) - (row.latestMetric?.cpu_temp ?? 0)) >= 8)}
                valueClassName={metricColor(row.latestMetric?.cpu_temp, 70, 85)}
              />
              <CompareCell
                label="OS"
                value={row.device.os_version ?? row.device.os_type}
                highlight={highlightDiffs && valuesByField.os > 1}
              />
              <CompareCell
                label="Uptime"
                value={row.latestMetric?.uptime_secs != null ? formatUptime(row.latestMetric.uptime_secs) : '—'}
                highlight={highlightDiffs && valuesByField.uptime > 1}
              />
              <CompareCell
                label="Alerts"
                value={String(row.alerts.length)}
                highlight={highlightDiffs && valuesByField.alertCount > 1}
              />
              <CompareCell
                label="Software"
                value={`${row.softwareCount} packages · ${row.pendingUpdates} updates pending`}
                highlight={highlightDiffs && valuesByField.softwareCount > 1}
              />
              <CompareCell
                label="Last Seen"
                value={row.device.last_seen ? formatDistanceToNow(new Date(row.device.last_seen), { addSuffix: true }) : 'Never'}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function CompareCell({
  label,
  value,
  highlight = false,
  valueClassName,
}: {
  label: string
  value: string
  highlight?: boolean
  valueClassName?: string
}) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${highlight ? 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/20' : 'border-slate-200 dark:border-gray-800'}`}>
      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-gray-600">{label}</p>
      <p className={`mt-1 font-medium text-slate-900 dark:text-gray-100 ${valueClassName ?? ''}`}>{value}</p>
    </div>
  )
}
