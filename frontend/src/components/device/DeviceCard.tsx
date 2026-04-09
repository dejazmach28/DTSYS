import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Monitor, Apple, Terminal } from 'lucide-react'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import type { Device } from '../../types'
import DeviceStatusBadge from './DeviceStatusBadge'
import { alertsApi } from '../../api/alerts'

interface Props {
  device: Device
  selected?: boolean
  onToggleSelect?: (deviceId: string) => void
}

const OSIcon = ({ os }: { os: string }) => {
  if (os === 'macos') return <Apple size={16} className="text-slate-400 dark:text-gray-400" />
  if (os === 'linux') return <Terminal size={16} className="text-slate-400 dark:text-gray-400" />
  return <Monitor size={16} className="text-slate-400 dark:text-gray-400" />
}

export default function DeviceCard({ device, selected = false, onToggleSelect }: Props) {
  const navigate = useNavigate()
  const { data: unresolvedAlerts = [] } = useQuery({
    queryKey: ['alerts', 'device-card', device.id],
    queryFn: () => alertsApi.list({ device_id: device.id, resolved: false }),
    enabled: device.status === 'alert',
    refetchInterval: 30_000,
  })

  return (
    <div
      onClick={() => navigate(`/devices/${device.id}`)}
      className={clsx(
        'group relative cursor-pointer rounded-xl border p-4 transition-all',
        selected
          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/20'
          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700 dark:hover:bg-gray-800/60',
      )}
    >
      {device.status === 'alert' && unresolvedAlerts.length > 0 && (
        <span className="absolute right-3 top-3 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
          {unresolvedAlerts.length}
        </span>
      )}

      {onToggleSelect && (
        <div className={`absolute left-3 top-3 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(device.id)}
            onClick={(event) => event.stopPropagation()}
            className="h-4 w-4 rounded border-slate-300 bg-white text-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-950"
            aria-label={`Select ${device.hostname}`}
          />
        </div>
      )}

      <div className="mb-3 flex items-start justify-between">
        <div className={`flex items-center gap-2 ${onToggleSelect ? 'pl-6' : ''}`}>
          <OSIcon os={device.os_type} />
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-gray-100">{device.label ?? device.hostname}</p>
            {device.label && <p className="text-xs text-slate-500 dark:text-gray-500">{device.hostname}</p>}
          </div>
        </div>
        <DeviceStatusBadge status={device.status} size="sm" />
      </div>

      <div className="space-y-1 text-xs text-slate-500 dark:text-gray-500">
        <p>{device.os_version ?? device.os_type}</p>
        <p>{device.ip_address ?? 'No IP'}</p>
        {device.last_seen && (
          <p>
            Last seen:{' '}
            <span className="text-slate-400 dark:text-gray-400">
              {formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
