import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Play, Plus } from 'lucide-react'
import { savedCommandsApi } from '../api/savedCommands'
import { devicesApi } from '../api/devices'
import { commandsApi } from '../api/commands'
import type { SavedCommand } from '../types'

const emptyForm = {
  name: '',
  description: '',
  command_type: 'shell',
  payload: { command: '' } as Record<string, unknown>,
  is_global: false,
  device_id: null as string | null,
}

export default function CommandLibrary() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<SavedCommand | 'new' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [runTarget, setRunTarget] = useState<{ command: SavedCommand | null; deviceId: string }>({ command: null, deviceId: '' })

  const { data: commands = [] } = useQuery({ queryKey: ['saved-commands'], queryFn: savedCommandsApi.list })
  const { data: devices = [] } = useQuery({ queryKey: ['devices', 'library'], queryFn: () => devicesApi.list() })

  const upsert = useMutation({
    mutationFn: () =>
      editing && editing !== 'new'
        ? savedCommandsApi.update(editing.id, { ...form, description: form.description || null, device_id: form.device_id })
        : savedCommandsApi.create({ ...form, description: form.description || null, device_id: form.device_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-commands'] })
      setEditing(null)
      setForm(emptyForm)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => savedCommandsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-commands'] }),
  })

  const runSaved = useMutation({
    mutationFn: ({ deviceId, command }: { deviceId: string; command: SavedCommand }) =>
      commandsApi.dispatch(deviceId, command.command_type, command.payload),
  })

  const sorted = useMemo(() => [...commands].sort((a, b) => a.name.localeCompare(b.name)), [commands])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Command Library</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-500">Reusable saved commands for faster remote operations.</p>
        </div>
        <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"><Plus size={14} />New Command</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-gray-950/60 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Global</th>
              <th className="px-3 py-2">Created By</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((command) => (
              <tr key={command.id} className="border-t border-slate-200 dark:border-gray-800">
                <td className="px-3 py-2 font-medium text-slate-900 dark:text-gray-100">{command.name}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-gray-300">{command.command_type}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-gray-300">{command.description ?? '—'}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-gray-300">{command.is_global ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-gray-300">{command.created_by ?? '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => {
                      setEditing(command)
                      setForm({
                        name: command.name,
                        description: command.description ?? '',
                        command_type: command.command_type,
                        payload: command.payload,
                        is_global: command.is_global,
                        device_id: command.device_id,
                      })
                    }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-gray-700">Edit</button>
                    <button onClick={() => setRunTarget({ command, deviceId: runTarget.deviceId })} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs text-blue-600 dark:border-blue-500/30 dark:text-blue-300"><span className="inline-flex items-center gap-1"><Play size={12} />Run</span></button>
                    <button onClick={() => remove.mutate(command.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 dark:border-red-500/30 dark:text-red-300">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'New Saved Command' : 'Edit Saved Command'} onClose={() => { setEditing(null); setForm(emptyForm) }}>
          <div className="space-y-3">
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Name" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
            <select value={form.command_type} onChange={(event) => setForm((current) => ({ ...current, command_type: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
              <option value="shell">Shell</option>
              <option value="update_check">Check Updates</option>
              <option value="reboot">Reboot</option>
              <option value="sync_time">Sync Time</option>
              <option value="diagnostics">Diagnostics</option>
            </select>
            {form.command_type === 'shell' && (
              <textarea value={String(form.payload.command ?? '')} onChange={(event) => setForm((current) => ({ ...current, payload: { command: event.target.value } }))} rows={4} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-800" />
            )}
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300">
              <input type="checkbox" checked={form.is_global} onChange={(event) => setForm((current) => ({ ...current, is_global: event.target.checked }))} />
              Global command
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => { setEditing(null); setForm(emptyForm) }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700">Cancel</button>
            <button onClick={() => upsert.mutate()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">Save</button>
          </div>
        </Modal>
      )}

      {runTarget.command && (
        <Modal title="Run Saved Command" onClose={() => setRunTarget({ command: null, deviceId: '' })}>
          <select value={runTarget.deviceId} onChange={(event) => setRunTarget((current) => ({ ...current, deviceId: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
            <option value="">Select device</option>
            {devices.map((device) => <option key={device.id} value={device.id}>{device.label ?? device.hostname}</option>)}
          </select>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setRunTarget({ command: null, deviceId: '' })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-700">Cancel</button>
            <button
              onClick={() => runTarget.command && runSaved.mutate({ deviceId: runTarget.deviceId, command: runTarget.command })}
              disabled={!runTarget.deviceId}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Run Command
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-blue-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-gray-100">{title}</h2>
          </div>
          <button onClick={onClose} className="text-sm text-slate-500 dark:text-gray-400">Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
