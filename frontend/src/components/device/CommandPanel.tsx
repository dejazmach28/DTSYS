import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commandsApi } from '../../api/commands'
import type { Command } from '../../types'
import { Terminal, Play, RotateCcw, RefreshCw, Clock3 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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
  const qc = useQueryClient()

  const { data: commands = [] } = useQuery({
    queryKey: ['commands', deviceId],
    queryFn: () => commandsApi.list(deviceId),
    refetchInterval: 5000,
  })

  const dispatch = useMutation({
    mutationFn: (command: string) =>
      commandsApi.dispatch(deviceId, 'shell', { command }),
    onSuccess: () => {
      setCommandText('')
      qc.invalidateQueries({ queryKey: ['commands', deviceId] })
    },
  })

  const quickActions = [
    { label: 'Check Updates', type: 'update_check', icon: RefreshCw },
    { label: 'Reboot (30s)', type: 'reboot', icon: RotateCcw },
    { label: 'Sync Time', type: 'sync_time', icon: Clock3 },
  ]

  return (
    <div className="space-y-4">
      {/* Shell input */}
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
          <Terminal size={14} className="shrink-0 text-slate-400 dark:text-gray-500" />
          <input
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commandText && dispatch.mutate(commandText)}
            placeholder="Run shell command..."
            className="flex-1 bg-transparent font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-gray-100 dark:placeholder:text-gray-600"
          />
        </div>
        <button
          onClick={() => commandText && dispatch.mutate(commandText)}
          disabled={!commandText || dispatch.isPending}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 rounded-lg transition-colors"
        >
          <Play size={15} />
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        {quickActions.map(({ label, type, icon: Icon }) => (
          <button
            key={type}
            onClick={() => commandsApi.dispatch(deviceId, type).then(() => qc.invalidateQueries({ queryKey: ['commands', deviceId] }))}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Command history */}
      <div className="space-y-1">
        {commands.map((cmd) => (
          <div
            key={cmd.id}
            onClick={() => setSelectedCmd(selectedCmd?.id === cmd.id ? null : cmd)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-slate-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
          >
            <div className="flex items-center justify-between text-xs">
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
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-100 p-2 font-mono whitespace-pre-wrap text-xs text-slate-600 dark:bg-gray-950 dark:text-gray-400">
                {cmd.output}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
