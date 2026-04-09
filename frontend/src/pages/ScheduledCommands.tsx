import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, Plus } from 'lucide-react'
import { scheduledCommandsApi } from '../api/scheduledCommands'
import { devicesApi } from '../api/devices'
import { nextRuns, parseCron } from '../utils/cron'

export default function ScheduledCommands() {
  const queryClient = useQueryClient()
  const { data: schedules = [] } = useQuery({
    queryKey: ['scheduled-commands'],
    queryFn: scheduledCommandsApi.list,
  })
  const { data: devices = [] } = useQuery({
    queryKey: ['devices', 'scheduled'],
    queryFn: () => devicesApi.list(),
  })
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState({
    target: 'all',
    device_id: '',
    command_type: 'sync_time',
    cron_expression: '0 3 * * *',
    shell_command: '',
  })

  const createSchedule = useMutation({
    mutationFn: () =>
      scheduledCommandsApi.create({
        device_id: form.target === 'all' ? null : form.device_id,
        command_type: form.command_type,
        cron_expression: form.cron_expression,
        payload: form.command_type === 'shell' ? { command: form.shell_command } : {},
        is_enabled: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-commands'] })
      setIsOpen(false)
    },
  })

  const toggleSchedule = useMutation({
    mutationFn: ({ id, is_enabled }: { id: string; is_enabled: boolean }) =>
      scheduledCommandsApi.update(id, { is_enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-commands'] })
    },
  })

  const previewRuns = useMemo(() => nextRuns(form.cron_expression, 3), [form.cron_expression])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Scheduled Commands</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-500">
            Automate recurring maintenance tasks across one device or the full fleet.
          </p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
        >
          <Plus size={14} />
          New Schedule
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-gray-950/60 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Schedule</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3">Last Run</th>
              <th className="px-4 py-3">Next Run</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => {
              const targetDevice = devices.find((device) => device.id === schedule.device_id)
              return (
                <tr key={schedule.id} className="border-t border-slate-200 dark:border-gray-800">
                  <td className="px-4 py-3 text-slate-700 dark:text-gray-100">
                    {targetDevice ? targetDevice.label ?? targetDevice.hostname : 'All devices'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-gray-300">{schedule.command_type}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-gray-300">{parseCron(schedule.cron_expression)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSchedule.mutate({ id: schedule.id, is_enabled: !schedule.is_enabled })}
                      className={`rounded-full px-2 py-1 text-xs ${
                        schedule.is_enabled
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {schedule.is_enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-gray-300">{schedule.last_run_at ?? 'Never'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-gray-300">{schedule.next_run_at ?? 'Not scheduled'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <Clock3 size={16} className="text-blue-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">New Schedule</h2>
            </div>
            <div className="space-y-3">
              <select
                value={form.target}
                onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">All devices</option>
                <option value="device">Specific device</option>
              </select>
              {form.target === 'device' && (
                <select
                  value={form.device_id}
                  onChange={(event) => setForm((current) => ({ ...current, device_id: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Choose a device</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label ?? device.hostname}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={form.command_type}
                onChange={(event) => setForm((current) => ({ ...current, command_type: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="shell">Shell</option>
                <option value="update_check">Check Updates</option>
                <option value="reboot">Reboot</option>
                <option value="sync_time">Sync Time</option>
              </select>
              {form.command_type === 'shell' && (
                <input
                  value={form.shell_command}
                  onChange={(event) => setForm((current) => ({ ...current, shell_command: event.target.value }))}
                  placeholder="Shell command"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              )}
              <input
                value={form.cron_expression}
                onChange={(event) => setForm((current) => ({ ...current, cron_expression: event.target.value }))}
                placeholder="Cron expression"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-300">
                <p>{parseCron(form.cron_expression)}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-gray-500">
                  Next runs: {previewRuns.map((run) => run.toLocaleString()).join(' · ')}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 dark:border-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => createSchedule.mutate()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
