import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Clock3, Columns3, Play, RefreshCw, RotateCcw, X } from 'lucide-react'
import { commandsApi } from '../../api/commands'

interface Props {
  selectedIds: string[]
  onClear: () => void
}

interface BulkToast {
  tone: 'success' | 'error'
  message: string
}

export default function BulkCommandBar({ selectedIds, onClear }: Props) {
  const navigate = useNavigate()
  const [isShellModalOpen, setIsShellModalOpen] = useState(false)
  const [shellCommand, setShellCommand] = useState('')
  const [toast, setToast] = useState<BulkToast | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const close = () => setIsShellModalOpen(false)
    window.addEventListener('dtsys:close-modals', close)
    return () => window.removeEventListener('dtsys:close-modals', close)
  }, [])

  const bulkDispatch = useMutation({
    mutationFn: ({ command_type, payload = {} }: { command_type: string; payload?: Record<string, unknown> }) =>
      commandsApi.bulk(selectedIds, command_type, payload),
    onSuccess: (result) => {
      setShellCommand('')
      setIsShellModalOpen(false)
      qc.invalidateQueries({ queryKey: ['devices'] })
      setToast({
        tone: 'success',
        message: `Command sent to ${result.dispatched.length} devices`,
      })
    },
    onError: (error: Error) => {
      setToast({
        tone: 'error',
        message: error.message || 'Bulk command failed',
      })
    },
  })

  const quickAction = (command_type: string, payload: Record<string, unknown> = {}) => {
    if (selectedIds.length < 2 || bulkDispatch.isPending) return
    bulkDispatch.mutate({ command_type, payload })
  }

  const submitShellCommand = () => {
    if (!shellCommand.trim()) return
    quickAction('shell', { command: shellCommand.trim() })
  }

  return (
    <>
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toast.tone === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/90 dark:text-emerald-100'
              : 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-950/90 dark:text-red-100'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 z-40 w-[min(94vw,64rem)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur dark:border-gray-700 dark:bg-gray-950/95">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-700 dark:text-gray-200">
            <span className="font-semibold text-slate-900 dark:text-white">{selectedIds.length}</span> devices selected
          </p>

          <ActionButton onClick={() => setIsShellModalOpen(true)} icon={Play} label="Run Command" />
          <ActionButton onClick={() => quickAction('reboot')} icon={RotateCcw} label="Reboot" disabled={bulkDispatch.isPending} />
          <ActionButton onClick={() => quickAction('update_check')} icon={RefreshCw} label="Check Updates" disabled={bulkDispatch.isPending} />
          <ActionButton onClick={() => quickAction('sync_time')} icon={Clock3} label="Sync Time" disabled={bulkDispatch.isPending} />
          <ActionButton
            onClick={() => navigate(`/compare?ids=${selectedIds.slice(0, 4).join(',')}`)}
            icon={Columns3}
            label="Compare"
          />

          <button
            onClick={onClear}
            className="ml-auto flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <X size={15} />
            Clear
          </button>
        </div>
      </div>

      {isShellModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-gray-100">Run Shell Command</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">
                  Dispatch a shell command to {selectedIds.length} selected devices.
                </p>
              </div>
              <button
                onClick={() => setIsShellModalOpen(false)}
                className="text-slate-500 transition-colors hover:text-slate-900 dark:text-gray-500 dark:hover:text-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            <input
              autoFocus
              value={shellCommand}
              onChange={(event) => setShellCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && shellCommand.trim()) {
                  submitShellCommand()
                }
              }}
              placeholder="uname -a"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 outline-none transition-colors focus:border-blue-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setIsShellModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={submitShellCommand}
                disabled={!shellCommand.trim() || bulkDispatch.isPending}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ActionButton({
  onClick,
  icon: Icon,
  label,
  disabled = false,
}: {
  onClick: () => void
  icon: typeof Play
  label: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-blue-600 hover:text-slate-900 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:text-white"
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
