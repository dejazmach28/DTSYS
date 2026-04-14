import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Clock3, Play, RefreshCw, RotateCcw, Stethoscope, Terminal, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { commandsApi } from '../../api/commands'
import { savedCommandsApi } from '../../api/savedCommands'
import type { Command } from '../../types'

interface Props {
  deviceId: string
}

const statusColor: Record<Command['status'], string> = {
  pending: 'text-gray-400',
  sent: 'text-blue-400',
  running: 'text-yellow-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
  timeout: 'text-orange-400',
}

export default function CommandPanel({ deviceId }: Props) {
  const [commandText, setCommandText] = useState('')
  const [selectedCmd, setSelectedCmd] = useState<Command | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [savedCommandName, setSavedCommandName] = useState('')
  const [savedCommandDescription, setSavedCommandDescription] = useState('')
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const { data: commands = [] } = useQuery({
    queryKey: ['commands', deviceId],
    queryFn: () => commandsApi.list(deviceId),
    refetchInterval: 5000,
  })
  const { data: savedCommands = [] } = useQuery({
    queryKey: ['saved-commands', 'panel'],
    queryFn: savedCommandsApi.list,
  })

  useEffect(() => {
    if (!selectedCmd) {
      return
    }
    const refreshed = commands.find((command) => command.id === selectedCmd.id)
    if (refreshed) {
      setSelectedCmd(refreshed)
    }
  }, [commands, selectedCmd])

  const dispatch = useMutation({
    mutationFn: ({ command_type, payload = {} }: { command_type: string; payload?: Record<string, unknown> }) =>
      commandsApi.dispatch(deviceId, command_type, payload),
    onSuccess: () => {
      setCommandText('')
      qc.invalidateQueries({ queryKey: ['commands', deviceId] })
    },
  })
  const saveCurrentCommand = useMutation({
    mutationFn: () =>
      savedCommandsApi.create({
        name: savedCommandName,
        description: savedCommandDescription || null,
        command_type: 'shell',
        payload: { command: commandText },
        is_global: false,
        device_id: null,
      }),
    onSuccess: () => {
      setSavedCommandName('')
      setSavedCommandDescription('')
      qc.invalidateQueries({ queryKey: ['saved-commands'] })
    },
  })

  const quickActions = [
    { label: 'Check Updates', type: 'update_check', icon: RefreshCw },
    { label: 'Reboot (30s)', type: 'reboot', icon: RotateCcw },
    { label: 'Sync Time', type: 'sync_time', icon: Clock3 },
    { label: 'Run Diagnostics', type: 'diagnostics', icon: Stethoscope },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
          <Terminal size={14} className="shrink-0 text-slate-400 dark:text-gray-500" />
          <input
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commandText && dispatch.mutate({ command_type: 'shell', payload: { command: commandText } })}
            placeholder="Run shell command..."
            className="flex-1 bg-transparent font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-gray-100 dark:placeholder:text-gray-600"
          />
        </div>
        <button
          onClick={() => commandText && dispatch.mutate({ command_type: 'shell', payload: { command: commandText } })}
          disabled={!commandText || dispatch.isPending}
          className="min-h-11 w-full rounded-lg bg-blue-600 px-4 text-white transition-colors hover:bg-blue-500 disabled:opacity-40 sm:w-auto"
        >
          <span className="inline-flex items-center gap-2">
            <Play size={15} />
            Send
          </span>
        </button>
        <button
          onClick={() => setLibraryOpen(true)}
          className="min-h-11 rounded-lg border border-slate-200 px-4 text-slate-700 transition-colors hover:border-blue-500 dark:border-gray-700 dark:text-gray-300"
        >
          <span className="inline-flex items-center gap-2">
            <BookOpen size={15} />
            Library
          </span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickActions.map(({ label, type, icon: Icon }) => (
          <button
            key={type}
            onClick={() =>
              dispatch.mutate({
                command_type: type,
                payload: type === 'sync_time' ? { target_time: new Date().toISOString() } : undefined,
              })
            }
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {commands.map((cmd) => (
          <div
            key={cmd.id}
            onClick={() => setSelectedCmd(selectedCmd?.id === cmd.id ? null : cmd)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-slate-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
          >
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-mono text-slate-700 dark:text-gray-300">
                {cmd.command_type === 'shell'
                  ? (cmd.payload as { command?: string }).command ?? 'shell'
                  : cmd.command_type}
              </span>
              <div className="flex items-center gap-3">
                <span className={statusColor[cmd.status]}>{cmd.status}</span>
                <span className="text-slate-400 dark:text-gray-600">
                  {formatDistanceToNow(new Date(cmd.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
            {selectedCmd?.id === cmd.id && cmd.output && (
              <div className="mt-2">
                {cmd.command_type === 'diagnostics' ? (
                  <div className="rounded-lg bg-slate-100 p-3 text-xs dark:bg-gray-950">
                    <JsonTree value={safeParseJSON(cmd.output)} />
                  </div>
                ) : (
                  <pre className="max-h-56 overflow-auto rounded bg-slate-100 p-2 whitespace-pre-wrap font-mono text-xs text-slate-600 dark:bg-gray-950 dark:text-gray-400">
                    {cmd.output}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {libraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-gray-100">Command Library</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">Reuse saved commands or save the current shell command.</p>
              </div>
              <button onClick={() => setLibraryOpen(false)} className="text-slate-500 dark:text-gray-400"><X size={18} /></button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search saved commands…"
                  className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {savedCommands
                    .filter((command) => command.name.toLowerCase().includes(search.toLowerCase()))
                    .map((command) => (
                      <div key={command.id} className="rounded-xl border border-slate-200 p-3 dark:border-gray-800">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-gray-100">{command.name}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">{command.description ?? 'No description'}</p>
                          </div>
                          <button
                            onClick={() => {
                              if (command.command_type === 'shell') {
                                setCommandText(String(command.payload.command ?? ''))
                              } else {
                                dispatch.mutate({ command_type: command.command_type, payload: command.payload })
                              }
                              setLibraryOpen(false)
                            }}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white"
                          >
                            Run
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-800">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-gray-100">Save Current</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">Store the current shell command in your personal library.</p>
                <input
                  value={savedCommandName}
                  onChange={(event) => setSavedCommandName(event.target.value)}
                  placeholder="Name"
                  className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                />
                <input
                  value={savedCommandDescription}
                  onChange={(event) => setSavedCommandDescription(event.target.value)}
                  placeholder="Description"
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                />
                <button
                  onClick={() => saveCurrentCommand.mutate()}
                  disabled={!commandText.trim() || !savedCommandName.trim()}
                  className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  Save Current
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function safeParseJSON(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function JsonTree({ value }: { value: unknown }) {
  if (value == null) {
    return <span className="text-slate-500 dark:text-gray-500">null</span>
  }
  if (typeof value === 'string') {
    return <span className="text-emerald-600 dark:text-emerald-300">"{value}"</span>
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="text-blue-600 dark:text-blue-300">{String(value)}</span>
  }
  if (Array.isArray(value)) {
            return (
      <div className="space-y-1">
        <span className="text-slate-500 dark:text-gray-500">[</span>
        {value.map((entry, index) => (
          <div key={index} className="pl-4">
            <JsonTree value={entry} />
          </div>
        ))}
        <span className="text-slate-500 dark:text-gray-500">]</span>
      </div>
    )
  }
  if (typeof value === 'object') {
    return (
      <div className="space-y-1">
        <span className="text-slate-500 dark:text-gray-500">{'{'}</span>
        {Object.entries(value).map(([key, entry]) => (
          <div key={key} className="pl-4">
            <span className="text-violet-600 dark:text-violet-300">{key}</span>
            <span className="text-slate-500 dark:text-gray-500">: </span>
            <JsonTree value={entry} />
          </div>
        ))}
        <span className="text-slate-500 dark:text-gray-500">{'}'}</span>
      </div>
    )
  }
  return <span>{String(value)}</span>
}
