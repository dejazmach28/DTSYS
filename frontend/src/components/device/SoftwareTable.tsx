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

  if (isLoading) return <div className="text-sm text-slate-500 dark:text-gray-500">Loading...</div>

  return (
    <div>
      {updatesAvailable > 0 && (
        <div className="mb-3 flex items-center gap-2 text-amber-400 text-sm">
          <ArrowUpCircle size={15} />
          {updatesAvailable} update{updatesAvailable > 1 ? 's' : ''} available
        </div>
      )}
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 dark:border-gray-800 dark:text-gray-500">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Version</th>
              <th className="pb-2 font-medium">Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-gray-800/60">
            {packages.map((pkg) => (
              <tr key={pkg.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/30">
                <td className="py-1.5 text-slate-800 dark:text-gray-200">{pkg.name}</td>
                <td className="py-1.5 font-mono text-xs text-slate-500 dark:text-gray-400">{pkg.version ?? '—'}</td>
                <td className="py-1.5">
                  {pkg.update_available ? (
                    <span className="text-amber-400 text-xs flex items-center gap-1">
                      <ArrowUpCircle size={12} /> {pkg.latest_version}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-gray-600">Up to date</span>
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
