import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Apple, Monitor, PackageOpen, Search, Terminal } from 'lucide-react'
import { devicesApi } from '../../api/devices'
import { softwareApi } from '../../api/software'
import type { Device, SoftwareSearchResult } from '../../types'
import DeviceStatusBadge from '../device/DeviceStatusBadge'
import { useGlobalSearchStore } from '../../store/globalSearchStore'

type SearchResult =
  | { kind: 'device'; key: string; device: Device }
  | { kind: 'software'; key: string; software: SoftwareSearchResult }

function OSIcon({ os }: { os: Device['os_type'] }) {
  if (os === 'macos') return <Apple size={14} className="text-slate-400 dark:text-gray-400" />
  if (os === 'linux') return <Terminal size={14} className="text-slate-400 dark:text-gray-400" />
  return <Monitor size={14} className="text-slate-400 dark:text-gray-400" />
}

export default function GlobalSearch() {
  const open = useGlobalSearchStore((state) => state.open)
  const closeSearch = useGlobalSearchStore((state) => state.closeSearch)
  const toggleSearch = useGlobalSearchStore((state) => state.toggleSearch)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        toggleSearch()
        return
      }

      if (event.key === 'Escape') {
        closeSearch()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeSearch, toggleSearch])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebouncedQuery('')
      setSelectedIndex(0)
      return
    }

    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [open, query])

  const { data: devices = [] } = useQuery({
    queryKey: ['global-search', 'devices', debouncedQuery],
    queryFn: () => devicesApi.list(undefined, debouncedQuery),
    enabled: open && debouncedQuery.length >= 2,
  })

  const { data: software = [] } = useQuery({
    queryKey: ['global-search', 'software', debouncedQuery],
    queryFn: () => softwareApi.search(debouncedQuery),
    enabled: open && debouncedQuery.length >= 2,
  })

  const results = useMemo<SearchResult[]>(
    () => [
      ...devices.map((device) => ({ kind: 'device', key: `device-${device.id}`, device }) as const),
      ...software.map((entry) => ({ kind: 'software', key: `software-${entry.name}`, software: entry }) as const),
    ],
    [devices, software]
  )

  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(Math.max(0, results.length - 1))
    }
  }, [results, selectedIndex])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!results.length) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((current) => (current + 1) % results.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((current) => (current - 1 + results.length) % results.length)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        handleSelect(results[selectedIndex])
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, results, selectedIndex])

  const handleSelect = (result: SearchResult) => {
    if (result.kind === 'device') {
      navigate(`/devices/${result.device.id}`)
    } else {
      navigate(`/software-updates?search=${encodeURIComponent(result.software.name)}`)
    }
    closeSearch()
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 pt-[10vh] backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-gray-800">
          <Search size={16} className="text-slate-400 dark:text-gray-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search devices and software..."
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          <button
            onClick={closeSearch}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 dark:border-gray-700 dark:text-gray-400"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {debouncedQuery.length < 2 ? (
            <p className="px-2 py-8 text-center text-sm text-slate-500 dark:text-gray-500">
              Type at least 2 characters to search.
            </p>
          ) : results.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-slate-500 dark:text-gray-500">
              No matching devices or software found.
            </p>
          ) : (
            <div className="space-y-4">
              {devices.length > 0 && (
                <section>
                  <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-500">
                    Devices
                  </p>
                  <div className="space-y-1">
                    {devices.map((device) => {
                      const index = results.findIndex((result) => result.key === `device-${device.id}`)
                      return (
                        <button
                          key={device.id}
                          onClick={() => handleSelect({ kind: 'device', key: `device-${device.id}`, device })}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                            selectedIndex === index
                              ? 'bg-blue-50 dark:bg-blue-950/30'
                              : 'hover:bg-slate-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <OSIcon os={device.os_type} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900 dark:text-gray-100">
                              {device.label ?? device.hostname}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-gray-500">
                              {device.hostname} · {device.ip_address ?? 'No IP'}
                            </p>
                          </div>
                          <DeviceStatusBadge status={device.status} size="sm" />
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {software.length > 0 && (
                <section>
                  <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-500">
                    Software
                  </p>
                  <div className="space-y-1">
                    {software.map((entry) => {
                      const index = results.findIndex((result) => result.key === `software-${entry.name}`)
                      return (
                        <button
                          key={entry.name}
                          onClick={() => handleSelect({ kind: 'software', key: `software-${entry.name}`, software: entry })}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                            selectedIndex === index
                              ? 'bg-blue-50 dark:bg-blue-950/30'
                              : 'hover:bg-slate-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <PackageOpen size={14} className="text-slate-400 dark:text-gray-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900 dark:text-gray-100">
                              {entry.name}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-gray-500">
                              {entry.device_count} devices · {entry.versions.join(', ') || 'Unknown version'}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
