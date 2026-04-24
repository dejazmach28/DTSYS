import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpCircle, Search, X } from 'lucide-react'
import api from '../../api/client'
import type { SoftwarePackage } from '../../types'
import Pagination from '../ui/Pagination'
import { SkeletonTable } from '../ui/Skeleton'

interface Props {
  deviceId: string
}

export default function SoftwareTable({ deviceId }: Props) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const pageSize = 100

  // Debounce search input to avoid firing on every keystroke
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
    clearTimeout((handleSearchChange as { _t?: ReturnType<typeof setTimeout> })._t)
    const t = setTimeout(() => setDebouncedSearch(value), 300)
    ;(handleSearchChange as { _t?: ReturnType<typeof setTimeout> })._t = t
  }

  const { data, isLoading } = useQuery({
    queryKey: ['software', deviceId, page, debouncedSearch],
    queryFn: () =>
      api
        .get<SoftwarePackage[]>(`/devices/${deviceId}/software`, {
          params: { skip: (page - 1) * pageSize, limit: pageSize, search: debouncedSearch || undefined },
        })
        .then((response) => ({
          data: response.data,
          total: Number(response.headers['x-total-count'] ?? response.data.length),
        })),
    refetchOnMount: 'always',
    refetchInterval: 120_000,
  })

  const packages = data?.data ?? []
  const total = data?.total ?? 0
  const updatesAvailable = packages.filter((p) => p.update_available).length

  if (isLoading) return <SkeletonTable rows={6} />

  return (
    <div>
      {/* Search bar */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search packages…"
            className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-8 pr-8 py-1.5 text-sm text-slate-700 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <span className="text-xs text-slate-400 dark:text-gray-500">
          {total.toLocaleString()} package{total !== 1 ? 's' : ''}
        </span>
        {updatesAvailable > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <ArrowUpCircle size={13} />
            {updatesAvailable} update{updatesAvailable > 1 ? 's' : ''} available
          </span>
        )}
      </div>

      {packages.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400 dark:text-gray-500">
          {debouncedSearch ? `No packages matching "${debouncedSearch}"` : 'No software inventory recorded.'}
        </p>
      ) : (
        <>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
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
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                          <ArrowUpCircle size={12} /> {pkg.latest_version}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
