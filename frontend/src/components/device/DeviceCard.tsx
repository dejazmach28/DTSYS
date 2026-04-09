import { useNavigate } from 'react-router-dom'
import { Monitor, Apple, Terminal } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Device } from '../../types'
import DeviceStatusBadge from './DeviceStatusBadge'

interface Props {
  device: Device
  selected?: boolean
  onToggleSelect?: (deviceId: string) => void
}

const OSIcon = ({ os }: { os: string }) => {
  if (os === 'macos') return <Apple size={16} className="text-gray-400" />
  if (os === 'linux') return <Terminal size={16} className="text-gray-400" />
  return <Monitor size={16} className="text-gray-400" />
}

export default function DeviceCard({ device, selected = false, onToggleSelect }: Props) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/devices/${device.id}`)}
      className={`group relative rounded-xl border p-4 transition-all ${
        selected
          ? 'border-blue-600 bg-blue-950/20'
          : 'border-gray-800 bg-gray-900 hover:border-blue-700 hover:bg-gray-800/60'
      } cursor-pointer`}
    >
      {onToggleSelect && (
        <div className={`absolute left-3 top-3 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(device.id)}
            onClick={(event) => event.stopPropagation()}
            className="h-4 w-4 rounded border-gray-600 bg-gray-950 text-blue-500 focus:ring-blue-500"
            aria-label={`Select ${device.hostname}`}
          />
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className={`flex items-center gap-2 ${onToggleSelect ? 'pl-6' : ''}`}>
          <OSIcon os={device.os_type} />
          <div>
            <p className="font-medium text-gray-100 text-sm">{device.label ?? device.hostname}</p>
            {device.label && <p className="text-xs text-gray-500">{device.hostname}</p>}
          </div>
        </div>
        <DeviceStatusBadge status={device.status} size="sm" />
      </div>

      <div className="space-y-1 text-xs text-gray-500">
        <p>{device.os_version ?? device.os_type}</p>
        <p>{device.ip_address ?? 'No IP'}</p>
        {device.last_seen && (
          <p>
            Last seen:{' '}
            <span className="text-gray-400">
              {formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
