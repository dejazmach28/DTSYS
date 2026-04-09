import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, parseISO, subDays } from 'date-fns'
import { alertsApi } from '../api/alerts'
import { devicesApi } from '../api/devices'
import { metricsApi } from '../api/metrics'
import api from '../api/client'
import type { Metric, SoftwarePackage } from '../types'

const ALERT_TYPES = ['offline', 'high_cpu', 'high_ram', 'disk_full', 'crash', 'time_drift']

export default function Reports() {
  const [from, setFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [deviceId, setDeviceId] = useState('all')

  const { data: devices = [] } = useQuery({
    queryKey: ['devices', 'reports'],
    queryFn: () => devicesApi.list(),
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', 'reports', deviceId],
    queryFn: () => alertsApi.list({ limit: 1000, device_id: deviceId === 'all' ? undefined : deviceId }),
  })

  const selectedDevices = useMemo(
    () => (deviceId === 'all' ? devices : devices.filter((device) => device.id === deviceId)),
    [deviceId, devices],
  )

  const rangeStart = useMemo(() => new Date(`${from}T00:00:00`), [from])
  const rangeEnd = useMemo(() => new Date(`${to}T23:59:59`), [to])
  const hours = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 3_600_000))

  const metricQueries = useQueries({
    queries: selectedDevices.map((device) => ({
      queryKey: ['reports', 'metrics', device.id, hours],
      queryFn: () => metricsApi.list(device.id, hours),
      enabled: selectedDevices.length > 0,
    })),
  })

  const softwareQueries = useQueries({
    queries: selectedDevices.map((device) => ({
      queryKey: ['reports', 'software', device.id],
      queryFn: () => api.get<SoftwarePackage[]>(`/devices/${device.id}/software`).then((response) => response.data),
      enabled: selectedDevices.length > 0,
    })),
  })

  const filteredAlerts = alerts.filter((alert) => {
    const created = parseISO(alert.created_at)
    return created >= rangeStart && created <= rangeEnd
  })

  const topAlerts = ALERT_TYPES.map((type) => ({
    type,
    count: filteredAlerts.filter((alert) => alert.alert_type === type).length,
  }))

  const uptimeRows = selectedDevices.map((device, index) => {
    const metrics = (metricQueries[index]?.data ?? []) as Metric[]
    const windowSeconds = Math.max(1, (rangeEnd.getTime() - rangeStart.getTime()) / 1000)
    const latestUptime = metrics.reduce((maximum, metric) => Math.max(maximum, metric.uptime_secs ?? 0), 0)
    const avgUptimePct = Math.min(100, (latestUptime / windowSeconds) * 100)
    const downtimeHours = ((100 - avgUptimePct) / 100) * (windowSeconds / 3600)
    const lastOffline = filteredAlerts
      .filter((alert) => alert.device_id === device.id && alert.alert_type === 'offline')
      .sort((left, right) => right.created_at.localeCompare(left.created_at))[0]

    return {
      device: device.label ?? device.hostname,
      avg_uptime_percent: `${avgUptimePct.toFixed(1)}%`,
      downtime_hours: downtimeHours.toFixed(1),
      last_offline_event: lastOffline?.created_at ? format(parseISO(lastOffline.created_at), 'PPp') : 'Never',
    }
  })

  const softwareRows = useMemo(() => {
    const aggregated = new Map<string, { software_name: string; devices: Set<string>; versions: Set<string> }>()

    selectedDevices.forEach((device, index) => {
      const packages = (softwareQueries[index]?.data ?? []) as SoftwarePackage[]
      packages
        .filter((pkg) => pkg.update_available)
        .forEach((pkg) => {
          const current = aggregated.get(pkg.name) ?? {
            software_name: pkg.name,
            devices: new Set<string>(),
            versions: new Set<string>(),
          }
          current.devices.add(device.label ?? device.hostname)
          if (pkg.version) {
            current.versions.add(pkg.version)
          }
          aggregated.set(pkg.name, current)
        })
    })

    return Array.from(aggregated.values()).map((entry) => ({
      software_name: entry.software_name,
      affected_devices_count: entry.devices.size,
      current_versions_seen: Array.from(entry.versions).join(', ') || 'Unknown',
    }))
  }, [selectedDevices, softwareQueries])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Reports</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-500">
          Historical summaries across alerts, uptime, and pending software updates.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3 dark:border-gray-800 dark:bg-gray-900">
        <input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <select
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="all">All devices</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.label ?? device.hostname}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-gray-200">Top Alerts</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topAlerts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#47556933" />
              <XAxis dataKey="type" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-200">Uptime Summary</h2>
          <button
            onClick={() => exportCSV('uptime-summary.csv', uptimeRows)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-gray-700 dark:text-gray-300"
          >
            Export CSV
          </button>
        </div>
        <DataTable
          headers={['Device', 'Avg Uptime %', 'Downtime Hours', 'Last Offline Event']}
          rows={uptimeRows.map((row) => [
            row.device,
            row.avg_uptime_percent,
            row.downtime_hours,
            row.last_offline_event,
          ])}
          emptyLabel="No uptime data"
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-200">Software Updates Pending</h2>
          <button
            onClick={() => exportCSV('software-updates.csv', softwareRows)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-gray-700 dark:text-gray-300"
          >
            Export CSV
          </button>
        </div>
        <DataTable
          headers={['Software Name', 'Affected Devices', 'Current Versions Seen']}
          rows={softwareRows.map((row) => [
            row.software_name,
            String(row.affected_devices_count),
            row.current_versions_seen,
          ])}
          emptyLabel="No pending software updates"
        />
      </section>
    </div>
  )
}

function DataTable({ headers, rows, emptyLabel }: { headers: string[]; rows: string[][]; emptyLabel: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-gray-800">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500 dark:bg-gray-950/60 dark:text-gray-400">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`} className="border-t border-slate-200 dark:border-gray-800">
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className="px-3 py-2 text-slate-700 dark:text-gray-200">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="px-3 py-4 text-center text-slate-500 dark:text-gray-500">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return
  }

  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => JSON.stringify(String(row[header] ?? '')))
        .join(','),
    ),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
