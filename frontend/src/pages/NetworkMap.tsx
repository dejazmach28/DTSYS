import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network } from 'lucide-react'
import { useDevices } from '../hooks/useDevices'

type StatusFilter = 'all' | 'online' | 'offline' | 'alert'

export default function NetworkMap() {
  const navigate = useNavigate()
  const { data: devices = [] } = useDevices()
  const [zoom, setZoom] = useState(1)
  const [filter, setFilter] = useState<StatusFilter>('all')

  const visibleDevices = devices.filter((device) => filter === 'all' || device.status === filter)

  const subnetGroups = useMemo(() => {
    const groups = new Map<string, typeof visibleDevices>()
    for (const device of visibleDevices) {
      const key = subnetOf(device.ip_address)
      const current = groups.get(key) ?? []
      current.push(device)
      groups.set(key, current)
    }
    return Array.from(groups.entries())
  }, [visibleDevices])

  const nodes = useMemo(() => {
    const serverX = 420
    const serverY = 240
    return subnetGroups.flatMap(([subnet, group], groupIndex) => {
      const angleOffset = (groupIndex / Math.max(1, subnetGroups.length)) * Math.PI * 2
      const baseRadius = 170 + groupIndex * 10
      const centerX = serverX + Math.cos(angleOffset) * baseRadius
      const centerY = serverY + Math.sin(angleOffset) * 110
      return group.map((device, deviceIndex) => {
        const localAngle = (deviceIndex / Math.max(1, group.length)) * Math.PI * 2
        return {
          device,
          subnet,
          x: centerX + Math.cos(localAngle) * 70,
          y: centerY + Math.sin(localAngle) * 50,
          groupX: centerX,
          groupY: centerY,
          groupWidth: Math.max(170, group.length * 42),
          groupHeight: 100,
        }
      })
    })
  }, [subnetGroups])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Network Map</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-500">Basic topology of devices connected to the DTSYS server.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'online', 'alert', 'offline'] as StatusFilter[]).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-2 text-sm capitalize ${filter === value ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
            >
              {value}
            </button>
          ))}
          <button
            onClick={() => setZoom((current) => Math.min(1.8, current + 0.1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            Zoom In
          </button>
          <button
            onClick={() => setZoom((current) => Math.max(0.7, current - 0.1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            Zoom Out
          </button>
          <button
            onClick={() => setZoom(1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            Reset Layout
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <svg viewBox="0 0 840 480" className="h-[32rem] min-w-[840px] w-full">
            <g transform={`scale(${zoom}) translate(${(1 - zoom) * 200} ${(1 - zoom) * 120})`}>
              {nodes.map((node) => (
                <ellipse
                  key={`group-${node.subnet}-${node.device.id}`}
                  cx={node.groupX}
                  cy={node.groupY}
                  rx={node.groupWidth / 2}
                  ry={node.groupHeight / 2}
                  fill="rgba(59, 130, 246, 0.06)"
                  stroke="rgba(59, 130, 246, 0.15)"
                />
              ))}

              {nodes.map((node) => (
                <line
                  key={`edge-${node.device.id}`}
                  x1={420}
                  y1={240}
                  x2={node.x}
                  y2={node.y}
                  stroke="rgba(148, 163, 184, 0.5)"
                  strokeWidth="1.5"
                />
              ))}

              <g>
                <circle cx="420" cy="240" r="30" fill="#2563eb" />
                <Network x="408" y="228" size={24} color="white" />
                <text x="420" y="285" textAnchor="middle" className="fill-slate-600 text-sm dark:fill-gray-300">
                  DTSYS Server
                </text>
              </g>

              {nodes.map((node) => (
                <g
                  key={node.device.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/devices/${node.device.id}`)}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="16"
                    className={node.device.status === 'online' ? 'animate-pulse' : undefined}
                    fill={statusColor(node.device.status)}
                  />
                  <title>{`${node.device.label ?? node.device.hostname}\n${node.device.ip_address ?? 'No IP'}\n${node.device.os_version ?? node.device.os_type}\n${node.device.status}`}</title>
                  <text x={node.x} y={node.y + 32} textAnchor="middle" className="fill-slate-700 text-xs dark:fill-gray-300">
                    {truncate(node.device.label ?? node.device.hostname)}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}

function subnetOf(ip: string | null) {
  if (!ip) {
    return 'unknown'
  }
  const [value] = ip.split('/')
  const parts = value.split('.')
  if (parts.length !== 4) {
    return 'unknown'
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
}

function statusColor(status: string) {
  switch (status) {
    case 'online':
      return '#22c55e'
    case 'alert':
      return '#ef4444'
    default:
      return '#94a3b8'
  }
}

function truncate(value: string, max = 18) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
