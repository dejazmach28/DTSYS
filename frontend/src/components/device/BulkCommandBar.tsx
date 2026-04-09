import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, RotateCcw, RefreshCw, Clock3, X } from 'lucide-react'
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
  const [isShellModalOpen, setIsShellModalOpen] = useState(false)
  const [shellCommand, setShellCommand] = useState('')
  const [toast, setToast] = useState<BulkToast | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

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
              ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
              : 'border-red-500/40 bg-red-950/90 text-red-100'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 z-40 w-[min(92vw,56rem)] -translate-x-1/2 rounded-2xl border border-gray-700 bg-gray-950/95 px-4 py-3 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-gray-200">
            <span className="font-semibold text-white">{selectedIds.length}</span> devices selected
          </p>

          <button
            onClick={() => setIsShellModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-blue-600 hover:text-white"
          >
            <Play size={14} />
            Run Command
          </button>

          <button
            onClick={() => quickAction('reboot')}
            disabled={bulkDispatch.isPending}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-amber-500 hover:text-white disabled:opacity-50"
          >
            <RotateCcw size={14} />
            Reboot
          </button>

          <button
            onClick={() => quickAction('update_check')}
            disabled={bulkDispatch.isPending}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-blue-600 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={14} />
            Check Updates
          </button>

          <button
            onClick={() => quickAction('sync_time')}
            disabled={bulkDispatch.isPending}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-emerald-500 hover:text-white disabled:opacity-50"
          >
            <Clock3 size={14} />
            Sync Time
          </button>

          <button
            onClick={onClear}
            className="ml-auto flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-sm text-gray-400 transition-colors hover:text-gray-100"
          >
            <X size={15} />
            Clear
          </button>
        </div>
      </div>

      {isShellModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-100">Run Shell Command</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Dispatch a shell command to {selectedIds.length} selected devices.
                </p>
              </div>
              <button
                onClick={() => setIsShellModalOpen(false)}
                className="text-gray-500 transition-colors hover:text-gray-200"
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
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm font-mono text-gray-100 outline-none transition-colors focus:border-blue-600"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setIsShellModalOpen(false)}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
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
