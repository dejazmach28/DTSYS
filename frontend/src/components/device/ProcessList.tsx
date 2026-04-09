import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { commandsApi } from '../../api/commands'
import { devicesApi } from '../../api/devices'

type SortKey = 'pid' | 'name' | 'cpu_percent' | 'mem_percent' | 'status'

export default function ProcessList({ deviceId, active }: { deviceId: string; active: boolean }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('cpu_percent')
  const [descending, setDescending] = useState(true)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['device-processes', deviceId],
    queryFn: () => devicesApi.processes(deviceId),
    enabled: active,
    retry: false,
    refetchInterval: active ? 60_000 : false,
  })

  const refreshProcesses = useMutation({
    mutationFn: () => commandsApi.dispatch(deviceId, 'request_process_list'),
    onSuccess: () => {
      window.setTimeout(() => {
        void refetch()
      }, 1000)
    },
  })

  const rows = useMemo(() => {
    const processes = [...(data?.processes ?? [])]
      .filter((proc) => proc.name.toLowerCase().includes(search.toLowerCase()))
      .sort((left, right) => {
        const leftValue = left[sortKey]
        const rightValue = right[sortKey]
        if (typeof leftValue === 'string' && typeof rightValue === 'string') {
          return descending ? rightValue.localeCompare(leftValue) : leftValue.localeCompare(rightValue)
        }
        return descending ? Number(rightValue) - Number(leftValue) : Number(leftValue) - Number(rightValue)
      })
    return processes
  }, [data?.processes, descending, search, sortKey])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setDescending((current) => !current)
      return
    }
    setSortKey(key)
    setDescending(key !== 'name' && key !== 'status')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by process name"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          onClick={() => refreshProcesses.mutate()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={refreshProcesses.isPending}
        >
          Refresh
        </button>
      </div>

      {isLoading && <p className="text-sm text-slate-500 dark:text-gray-500">Loading processes...</p>}
      {!isLoading && error && <p className="text-sm text-slate-500 dark:text-gray-500">No process list available yet.</p>}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-gray-950/60 dark:text-gray-400">
              <tr>
                {[
                  ['pid', 'PID'],
                  ['name', 'Name'],
                  ['cpu_percent', 'CPU%'],
                  ['mem_percent', 'Mem%'],
                  ['status', 'Status'],
                ].map(([key, label]) => (
                  <th key={key} className="px-3 py-2">
                    <button onClick={() => toggleSort(key as SortKey)}>{label}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((proc) => (
                <tr
                  key={`${proc.pid}-${proc.name}`}
                  className={`border-t border-slate-200 dark:border-gray-800 ${
                    proc.cpu_percent > 50
                      ? 'bg-red-50 dark:bg-red-500/10'
                      : proc.cpu_percent > 20
                        ? 'bg-amber-50 dark:bg-amber-500/10'
                        : ''
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-slate-700 dark:text-gray-300">{proc.pid}</td>
                  <td className="px-3 py-2 text-slate-900 dark:text-gray-100">{proc.name}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-gray-300">{proc.cpu_percent.toFixed(1)}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-gray-300">{proc.mem_percent.toFixed(1)}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-gray-300">{proc.status}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500 dark:text-gray-500">
                    No matching processes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
