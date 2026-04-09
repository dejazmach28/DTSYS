import { useState } from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { useAlerts, useResolveAlert } from '../hooks/useAlerts'
import { formatDistanceToNow } from 'date-fns'
import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import { useDevices } from '../hooks/useDevices'
import { exportToCSV } from '../utils/export'

const severityConfig = {
  critical: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-500' },
  warning: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
  info: { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: 'bg-blue-500' },
}

export default function Alerts() {
  const [showResolved, setShowResolved] = useState(false)
  const { data: alerts = [] } = useAlerts({ resolved: showResolved ? undefined : false })
  const { data: devices = [] } = useDevices()
  const resolve = useResolveAlert()

  const deviceNames = Object.fromEntries(
    devices.map((device) => [device.id, device.label ?? device.hostname])
  )

  const groupedByDevice = alerts.reduce<Record<string, typeof alerts>>((acc, alert) => {
    acc[alert.device_id] = [...(acc[alert.device_id] ?? []), alert]
    return acc
  }, {})

  const summary = alerts.reduce(
    (acc, alert) => {
      acc[alert.severity] += 1
      return acc
    },
    { critical: 0, warning: 0, info: 0 }
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Alerts</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-500">{alerts.filter((a) => !a.is_resolved).length} unresolved</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              exportToCSV(
                'alerts.csv',
                ['Alert Type', 'Severity', 'Device', 'Message', 'Created At'],
                alerts.map((alert) => [
                  alert.alert_type,
                  alert.severity,
                  deviceNames[alert.device_id] ?? alert.device_id,
                  alert.message,
                  alert.created_at,
                ])
              )
            }
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-gray-700 dark:text-gray-300"
          >
            Export CSV
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="accent-blue-500"
            />
            Show resolved
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-900">
        <span className="font-medium text-red-400">{summary.critical} critical</span>
        <span className="font-medium text-amber-400">{summary.warning} warnings</span>
        <span className="font-medium text-blue-400">{summary.info} info</span>
      </div>

      {alerts.length === 0 ? (
        <div className="py-16 text-center text-slate-500 dark:text-gray-600">
          <AlertTriangle size={40} className="mx-auto mb-3 opacity-30" />
          <p>No alerts</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groupedByDevice).map(([deviceId, deviceAlerts]) => (
            <section key={deviceId} className="space-y-2">
              <div className="flex items-center justify-between">
                <Link to={`/devices/${deviceId}`} className="text-sm font-semibold text-slate-900 hover:text-blue-500 dark:text-gray-100 dark:hover:text-blue-400">
                  {deviceNames[deviceId] ?? deviceId}
                </Link>
                <button
                  onClick={() =>
                    Promise.all(
                      deviceAlerts
                        .filter((alert) => !alert.is_resolved)
                        .map((alert) => resolve.mutateAsync(alert.id))
                    )
                  }
                  disabled={deviceAlerts.every((alert) => alert.is_resolved) || resolve.isPending}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-green-500 hover:text-slate-900 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:text-white"
                >
                  Resolve All
                </button>
              </div>

              {deviceAlerts.map((alert) => {
                const cfg = severityConfig[alert.severity] ?? severityConfig.info
                return (
                  <div
                    key={alert.id}
                    className={clsx(
                      'flex items-start gap-3 rounded-xl border bg-white px-4 py-3 dark:bg-gray-900',
                      alert.is_resolved
                        ? 'border-slate-200 opacity-50 dark:border-gray-800'
                        : 'border-slate-300 dark:border-gray-700',
                    )}
                  >
                    <span className={clsx('w-2 h-2 rounded-full shrink-0 mt-1.5', cfg.dot)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={clsx('text-xs px-1.5 py-0.5 rounded border font-medium', cfg.badge)}
                        >
                          {alert.severity}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-gray-800 dark:text-gray-500">
                          {alert.alert_type.replace(/_/g, ' ')}
                        </span>
                        <span className="ml-auto text-xs text-slate-400 dark:text-gray-600">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700 dark:text-gray-300">{alert.message}</p>
                    </div>
                    {!alert.is_resolved && (
                      <button
                        onClick={() => resolve.mutate(alert.id)}
                        className="shrink-0 text-slate-400 transition-colors hover:text-green-400 dark:text-gray-600"
                        title="Resolve"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
