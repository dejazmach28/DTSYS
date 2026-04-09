import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { devicesApi } from '../../api/devices'
import api from '../../api/client'
import type { Event } from '../../types'

interface Props {
  deviceId: string
  mode?: 'system' | 'agent'
}

const typeColor: Record<string, string> = {
  crash: 'text-red-400 bg-red-400/10',
  error: 'text-orange-400 bg-orange-400/10',
  warning: 'text-yellow-400 bg-yellow-400/10',
  info: 'text-blue-400 bg-blue-400/10',
  agent_log: 'text-emerald-400 bg-emerald-400/10',
}

export default function EventLog({ deviceId, mode = 'system' }: Props) {
  const { data: events = [] } = useQuery({
    queryKey: ['events', deviceId, mode],
    queryFn: () =>
      mode === 'agent'
        ? devicesApi.agentLogs(deviceId)
        : api.get<Event[]>(`/devices/${deviceId}/events`).then((response) => response.data),
    refetchInterval: 30_000,
  })

  if (events.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-gray-500">No {mode === 'agent' ? 'agent logs' : 'events'} recorded.</p>
  }

  if (mode === 'agent') {
    return (
      <div className="max-h-96 overflow-auto rounded-xl border border-slate-800 bg-black p-3 font-mono text-xs text-slate-100">
        {events.map((event) => {
          const level = String(event.source ?? '').includes('error')
            ? 'ERROR'
            : String(event.source ?? '').includes('warn')
              ? 'WARN'
              : 'INFO'
          const levelColor = level === 'ERROR' ? 'text-red-400' : level === 'WARN' ? 'text-yellow-400' : 'text-emerald-400'
          return (
            <div key={event.id} className="border-b border-slate-800/70 py-1.5 last:border-b-0">
              <span className="text-slate-500">{format(new Date(event.time), 'MM-dd HH:mm:ss')} </span>
              <span className={levelColor}>{level}</span>
              <span className="text-slate-400"> {event.source ?? 'agent/main'} </span>
              <span>{event.message}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="max-h-80 space-y-1 overflow-auto">
      {events.map((ev) => (
        <div key={ev.id} className="flex gap-3 border-b border-slate-200 py-1.5 text-xs dark:border-gray-800/60">
          <span className="shrink-0 font-mono text-slate-400 dark:text-gray-600">
            {format(new Date(ev.time), 'MM-dd HH:mm:ss')}
          </span>
          <span
            className={clsx(
              'shrink-0 self-start rounded px-1.5 text-xs font-medium',
              typeColor[ev.event_type] ?? 'bg-slate-200 text-slate-500 dark:bg-gray-400/10 dark:text-gray-400',
            )}
          >
            {ev.event_type.toUpperCase()}
          </span>
          <span className="break-all text-slate-700 dark:text-gray-300">{ev.message}</span>
          {ev.source && <span className="shrink-0 text-slate-400 dark:text-gray-600">- {ev.source}</span>}
        </div>
      ))}
    </div>
  )
}
