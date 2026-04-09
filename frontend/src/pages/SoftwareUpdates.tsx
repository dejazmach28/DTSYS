import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, PackageOpen } from 'lucide-react'
import { softwareUpdatesApi } from '../api/softwareUpdates'
import { useDevices } from '../hooks/useDevices'
import { exportToCSV } from '../utils/export'

export default function SoftwareUpdates() {
  const [searchParams] = useSearchParams()
  const [selected, setSelected] = useState<string[]>([])
  const [expanded, setExpanded] = useState<string[]>([])
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const { data: pending = [] } = useQuery({
    queryKey: ['software-updates', 'pending'],
    queryFn: softwareUpdatesApi.pending,
    refetchInterval: 60_000,
  })
  const { data: devices = [] } = useDevices()
  const dispatchUpdates = useMutation({
    mutationFn: ({ softwareNames, deviceIds }: { softwareNames: string[]; deviceIds: string[] }) =>
      softwareUpdatesApi.dispatch(softwareNames, deviceIds),
  })

  const deviceNames = useMemo(
    () => Object.fromEntries(devices.map((device) => [device.id, device.label ?? device.hostname])),
    [devices]
  )

  const filtered = pending.filter((entry) =>
    entry.software_name.toLowerCase().includes(search.toLowerCase())
  )
  const totalDevices = new Set(filtered.flatMap((entry) => entry.affected_device_ids)).size

  const toggleSelected = (name: string) => {
    setSelected((current) => (current.includes(name) ? current.filter((value) => value !== name) : [...current, name]))
  }

  const runUpdate = (softwareNames: string[]) => {
    const deviceIds = Array.from(
      new Set(
        filtered
          .filter((entry) => softwareNames.includes(entry.software_name))
          .flatMap((entry) => entry.affected_device_ids)
      )
    )
    dispatchUpdates.mutate({ softwareNames, deviceIds })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Software Updates</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-500">
          {filtered.length} packages have updates available across {totalDevices} devices
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by package name"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          onClick={() => runUpdate(selected)}
          disabled={selected.length === 0 || dispatchUpdates.isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Update Selected
        </button>
        <button
          onClick={() =>
            exportToCSV(
              'software-updates.csv',
              ['Package', 'Affected Count', 'Device IDs'],
              filtered.map((entry) => [
                entry.software_name,
                String(entry.affected_count),
                entry.affected_device_ids.join(' '),
              ])
            )
          }
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 dark:border-gray-700 dark:text-gray-300"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-gray-950/60 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Package</th>
              <th className="px-3 py-2">Affected Devices</th>
              <th className="px-3 py-2">Versions in Use</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const isExpanded = expanded.includes(entry.software_name)
              return (
                <Fragment key={entry.software_name}>
                  <tr className="border-t border-slate-200 dark:border-gray-800">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(entry.software_name)}
                        onChange={() => toggleSelected(entry.software_name)}
                        className="accent-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() =>
                          setExpanded((current) =>
                            current.includes(entry.software_name)
                              ? current.filter((value) => value !== entry.software_name)
                              : [...current, entry.software_name]
                          )
                        }
                        className="flex items-center gap-2 text-left"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="font-medium text-slate-900 dark:text-gray-100">{entry.software_name}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${severityColor(entry.affected_count)}`}>
                        {entry.affected_count}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-gray-300">{entry.current_versions.join(', ') || 'Unknown'}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => runUpdate([entry.software_name])}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-gray-700 dark:text-gray-300"
                      >
                        Update All
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t border-slate-100 bg-slate-50/70 dark:border-gray-800 dark:bg-gray-950/40">
                      <td />
                      <td colSpan={4} className="px-3 py-3">
                        <div className="space-y-2">
                          {entry.affected_device_ids.map((deviceId) => (
                            <div key={deviceId} className="flex items-center justify-between text-sm">
                              <span className="text-slate-900 dark:text-gray-100">{deviceNames[deviceId] ?? deviceId}</span>
                              <span className="text-slate-500 dark:text-gray-500">
                                {entry.current_versions.join(', ') || 'Unknown'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-slate-500 dark:text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <PackageOpen size={26} className="opacity-40" />
                    <span>No pending software updates found.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function severityColor(count: number) {
  if (count > 10) return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
  if (count > 3) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
}
