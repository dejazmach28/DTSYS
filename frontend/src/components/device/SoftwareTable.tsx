import { useQuery } from '@tanstack/react-query'
import api from '../../api/client'
import type { SoftwarePackage } from '../../types'
import { ArrowUpCircle } from 'lucide-react'

interface Props {
  deviceId: string
}

export default function SoftwareTable({ deviceId }: Props) {
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['software', deviceId],
    queryFn: () => api.get<SoftwarePackage[]>(`/devices/${deviceId}/software`).then((r) => r.data),
  })

  const updatesAvailable = packages.filter((p) => p.update_available).length

  if (isLoading) return <div className="text-gray-500 text-sm">Loading...</div>

  return (
    <div>
      {updatesAvailable > 0 && (
        <div className="mb-3 flex items-center gap-2 text-amber-400 text-sm">
          <ArrowUpCircle size={15} />
          {updatesAvailable} update{updatesAvailable > 1 ? 's' : ''} available
        </div>
      )}
      <div className="overflow-auto max-h-80">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Version</th>
              <th className="pb-2 font-medium">Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {packages.map((pkg) => (
              <tr key={pkg.id} className="hover:bg-gray-800/30">
                <td className="py-1.5 text-gray-200">{pkg.name}</td>
                <td className="py-1.5 text-gray-400 font-mono text-xs">{pkg.version ?? '—'}</td>
                <td className="py-1.5">
                  {pkg.update_available ? (
                    <span className="text-amber-400 text-xs flex items-center gap-1">
                      <ArrowUpCircle size={12} /> {pkg.latest_version}
                    </span>
                  ) : (
                    <span className="text-gray-600 text-xs">Up to date</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
