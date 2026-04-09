import { useQuery } from '@tanstack/react-query'
import { devicesApi } from '../../api/devices'

interface Props {
  deviceId: string
}

export default function NetworkInfo({ deviceId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['device-network', deviceId],
    queryFn: () => devicesApi.network(deviceId),
    enabled: !!deviceId,
    refetchInterval: 60_000,
  })

  const interfaces = data?.interfaces ?? []

  if (isLoading) {
    return <div className="text-sm text-slate-500 dark:text-gray-500">Loading network data...</div>
  }

  if (interfaces.length === 0) {
    return <div className="text-sm text-slate-500 dark:text-gray-500">No network data</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 dark:border-gray-800 dark:text-gray-500">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">MAC</th>
            <th className="px-3 py-2 font-medium">IPv4</th>
            <th className="px-3 py-2 font-medium">IPv6</th>
            <th className="px-3 py-2 font-medium">MTU</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {interfaces.map((iface) => (
            <tr key={iface.id} className="border-b border-slate-200 text-slate-700 dark:border-gray-900 dark:text-gray-300">
              <td className="px-3 py-3 font-medium text-slate-900 dark:text-gray-100">{iface.interface_name}</td>
              <td className="px-3 py-3 font-mono text-xs">{iface.mac_address || '—'}</td>
              <td className="px-3 py-3">{iface.ipv4.length > 0 ? iface.ipv4.join(', ') : '—'}</td>
              <td className="px-3 py-3">{iface.ipv6.length > 0 ? iface.ipv6.join(', ') : '—'}</td>
              <td className="px-3 py-3">{iface.mtu ?? '—'}</td>
              <td className="px-3 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    iface.is_up
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-200 text-slate-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {iface.is_up ? 'up' : 'down'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
