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
  const data = [...metrics]
    .reverse()
    .map((m) => ({
      time: format(new Date(m.time), 'HH:mm'),
      CPU: m.cpu_percent != null ? Math.round(m.cpu_percent) : null,
      RAM: m.ram_percent != null ? Math.round(m.ram_percent) : null,
      Disk: m.disk_percent != null ? Math.round(m.disk_percent) : null,
    }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} unit="%" />
        <Tooltip
          contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#9ca3af' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="CPU" stroke="#3b82f6" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="RAM" stroke="#10b981" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="Disk" stroke="#f59e0b" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}
