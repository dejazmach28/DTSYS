import { clsx } from 'clsx'

interface Props {
  status: 'online' | 'offline' | 'alert'
  size?: 'sm' | 'md'
}

const config = {
  online: { dot: 'bg-green-400', label: 'Online', text: 'text-green-400' },
  offline: { dot: 'bg-gray-500', label: 'Offline', text: 'text-gray-400' },
  alert: { dot: 'bg-red-500 animate-pulse', label: 'Alert', text: 'text-red-400' },
}

export default function DeviceStatusBadge({ status, size = 'md' }: Props) {
  const { dot, label, text } = config[status] ?? config.offline
  return (
    <span className={clsx('inline-flex items-center gap-1.5', text, size === 'sm' ? 'text-xs' : 'text-sm')}>
      <span className={clsx('rounded-full', dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {label}
    </span>
  )
}
