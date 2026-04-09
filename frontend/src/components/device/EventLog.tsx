import { useQuery } from '@tanstack/react-query'
import api from '../../api/client'
import type { Event } from '../../types'
import { format } from 'date-fns'
import { clsx } from 'clsx'

interface Props {
  deviceId: string
}

const typeColor: Record<string, string> = {
  crash: 'text-red-400 bg-red-400/10',
  error: 'text-orange-400 bg-orange-400/10',
  warning: 'text-yellow-400 bg-yellow-400/10',
  info: 'text-blue-400 bg-blue-400/10',
}

export default function EventLog({ deviceId }: Props) {
  const { data: events = [] } = useQuery({
    queryKey: ['events', deviceId],
    queryFn: () => api.get<Event[]>(`/devices/${deviceId}/events`).then((r) => r.data),
    refetchInterval: 30_000,
  })

  if (events.length === 0) {
    return <p className="text-gray-600 text-sm">No events recorded.</p>
  }

  return (
    <div className="space-y-1 max-h-80 overflow-auto">
      {events.map((ev) => (
        <div key={ev.id} className="flex gap-3 text-xs py-1.5 border-b border-gray-800/60">
          <span className="text-gray-600 shrink-0 font-mono">
            {format(new Date(ev.time), 'MM-dd HH:mm:ss')}
          </span>
          <span
            className={clsx(
              'px-1.5 rounded text-xs font-medium shrink-0 self-start',
              typeColor[ev.event_type] ?? 'text-gray-400 bg-gray-400/10'
            )}
          >
            {ev.event_type.toUpperCase()}
          </span>
          <span className="text-gray-300 break-all">{ev.message}</span>
          {ev.source && <span className="text-gray-600 shrink-0">— {ev.source}</span>}
        </div>
      ))}
    </div>
  )
}
