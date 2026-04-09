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
        <div className="flex-1 flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
          <Terminal size={14} className="text-gray-500 shrink-0" />
          <input
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commandText && dispatch.mutate(commandText)}
            placeholder="Run shell command..."
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 outline-none font-mono"
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
            className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg px-3 py-1.5 transition-colors"
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
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 cursor-pointer hover:border-gray-600"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-gray-300">
                {cmd.command_type === 'shell'
                  ? (cmd.payload as { command?: string }).command ?? 'shell'
                  : cmd.command_type}
              </span>
              <div className="flex items-center gap-3">
                <span className={statusColor[cmd.status]}>{cmd.status}</span>
                <span className="text-gray-600">
                  {formatDistanceToNow(new Date(cmd.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
            {selectedCmd?.id === cmd.id && cmd.output && (
              <pre className="mt-2 text-xs text-gray-400 bg-gray-900 rounded p-2 overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                {cmd.output}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
