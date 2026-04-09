import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import type { Metric } from '../../types'

interface Props {
  metrics: Metric[]
}

export default function MetricsChart({ metrics }: Props) {
  const [expanded, setExpanded] = useState(false)
  const data = [...metrics]
    .reverse()
    .map((m) => ({
      time: format(new Date(m.time), 'HH:mm'),
      CPU: m.cpu_percent != null ? Math.round(m.cpu_percent) : null,
      RAM: m.ram_percent != null ? Math.round(m.ram_percent) : null,
      Disk: m.disk_percent != null ? Math.round(m.disk_percent) : null,
      DiskRead: m.disk_read_mbps,
      DiskWrite: m.disk_write_mbps,
      NetSent: m.net_sent_mbps,
      NetRecv: m.net_recv_mbps,
    }))

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#47556933" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#cbd5e1' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="CPU" stroke="#3b82f6" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="RAM" stroke="#10b981" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="Disk" stroke="#f59e0b" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>

      <button
        onClick={() => setExpanded((current) => !current)}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-gray-700 dark:text-gray-300"
      >
        {expanded ? 'Hide I/O charts' : 'Expand I/O charts'}
      </button>

      {expanded && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-gray-400">Disk I/O</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#47556933" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit=" MB/s" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="DiskRead" name="Read MB/s" stroke="#2563eb" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="DiskWrite" name="Write MB/s" stroke="#f97316" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-gray-400">Network</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#47556933" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit=" MB/s" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="NetSent" name="Sent MB/s" stroke="#7c3aed" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="NetRecv" name="Recv MB/s" stroke="#16a34a" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
