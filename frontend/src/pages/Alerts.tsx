import { useState } from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { useAlerts, useResolveAlert } from '../hooks/useAlerts'
import { formatDistanceToNow } from 'date-fns'
import { clsx } from 'clsx'
import { useNavigate } from 'react-router-dom'

const severityConfig = {
  critical: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-500' },
  warning: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
  info: { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: 'bg-blue-500' },
}

export default function Alerts() {
  const [showResolved, setShowResolved] = useState(false)
  const { data: alerts = [] } = useAlerts({ resolved: showResolved ? undefined : false })
  const resolve = useResolveAlert()
  const navigate = useNavigate()

  const grouped = alerts.reduce(
    (acc, a) => {
      const key = a.severity as keyof typeof severityConfig
      acc[key] = (acc[key] ?? []).concat(a)
      return acc
    },
    {} as Record<string, typeof alerts>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Alerts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{alerts.filter((a) => !a.is_resolved).length} unresolved</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="accent-blue-500"
          />
          Show resolved
        </label>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <AlertTriangle size={40} className="mx-auto mb-3 opacity-30" />
          <p>No alerts</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const cfg = severityConfig[alert.severity] ?? severityConfig.info
            return (
              <div
                key={alert.id}
                className={clsx(
                  'bg-gray-900 border rounded-xl px-4 py-3 flex items-start gap-3',
                  alert.is_resolved ? 'border-gray-800 opacity-50' : 'border-gray-700'
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
                    <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                      {alert.alert_type.replace(/_/g, ' ')}
                    </span>
                    <button
                      onClick={() => navigate(`/devices/${alert.device_id}`)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      View device
                    </button>
                    <span className="text-xs text-gray-600 ml-auto">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mt-1">{alert.message}</p>
                </div>
                {!alert.is_resolved && (
                  <button
                    onClick={() => resolve.mutate(alert.id)}
                    className="shrink-0 text-gray-600 hover:text-green-400 transition-colors"
                    title="Resolve"
                  >
                    <CheckCircle size={16} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
