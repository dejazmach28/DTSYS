import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Plus, RefreshCw } from 'lucide-react'
import api from '../api/client'
import { notificationRulesApi } from '../api/notificationRules'
import { useAuthStore } from '../store/authStore'

export default function Settings() {
  const { role } = useAuthStore()
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer' })
  const [newRule, setNewRule] = useState({
    alert_type: '*',
    severity_min: 'warning',
    channel: 'browser' as 'browser' | 'webhook',
    webhook_url: '',
  })
  const [token, setToken] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const queryClient = useQueryClient()

  const { data: rules = [] } = useQuery({
    queryKey: ['notification-rules'],
    queryFn: notificationRulesApi.list,
    enabled: role === 'admin',
  })

  const createRule = useMutation({
    mutationFn: () =>
      notificationRulesApi.create({
        ...newRule,
        webhook_url: newRule.channel === 'webhook' ? newRule.webhook_url : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] })
      setNewRule({ alert_type: '*', severity_min: 'warning', channel: 'browser', webhook_url: '' })
    },
  })

  const updateRule = useMutation({
    mutationFn: ({ id, is_enabled }: { id: string; is_enabled: boolean }) =>
      notificationRulesApi.update(id, { is_enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] })
    },
  })

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await api.post('/admin/users', newUser)
      setMsg('User created successfully')
      setNewUser({ username: '', password: '', role: 'viewer' })
    } catch {
      setMsg('Failed to create user')
    }
  }

  const generateToken = async () => {
    const response = await api.post('/admin/enrollment-tokens')
    setToken(response.data.enrollment_token)
  }

  if (role !== 'admin') {
    return (
      <div className="p-4 text-sm text-slate-500 dark:text-gray-500">
        Admin access required to view settings.
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-500">Administration</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-gray-200">Enrollment Token</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-gray-500">
          Generate a one-time token to register a new device agent.
        </p>
        {token ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-green-600 dark:bg-gray-800 dark:text-green-400">
              {token}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(token)}
              className="text-slate-500 transition-colors hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              <Copy size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={generateToken}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
          >
            <RefreshCw size={14} />
            Generate Token
          </button>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-gray-200">Create User</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-gray-500">Add a new dashboard user account.</p>

        {msg && (
          <div className="mb-3 rounded px-3 py-2 text-xs text-blue-400 bg-blue-400/10">{msg}</div>
        )}

        <form onSubmit={createUser} className="space-y-3">
          <input
            value={newUser.username}
            onChange={(event) => setNewUser((current) => ({ ...current, username: event.target.value }))}
            placeholder="Username"
            required
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <input
            type="password"
            value={newUser.password}
            onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
            placeholder="Password"
            required
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <select
            value={newUser.role}
            onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
          >
            <Plus size={14} />
            Create User
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-gray-200">Notification Rules</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-gray-500">
          Control browser and webhook notifications for new alerts.
        </p>

        <div className="mb-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-gray-950/60 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">Alert</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-slate-200 dark:border-gray-800">
                  <td className="px-3 py-2 text-slate-900 dark:text-gray-100">{rule.alert_type}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-gray-300">{rule.severity_min}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-gray-300">{rule.channel}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-gray-300">{rule.webhook_url ?? 'Browser session'}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => updateRule.mutate({ id: rule.id, is_enabled: !rule.is_enabled })}
                      className={`rounded-full px-2 py-1 text-xs ${
                        rule.is_enabled
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {rule.is_enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-500 dark:text-gray-500">
                    No notification rules configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={newRule.alert_type}
            onChange={(event) => setNewRule((current) => ({ ...current, alert_type: event.target.value }))}
            placeholder="Alert type or *"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <select
            value={newRule.severity_min}
            onChange={(event) => setNewRule((current) => ({ ...current, severity_min: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="info">Info+</option>
            <option value="warning">Warning+</option>
            <option value="critical">Critical only</option>
          </select>
          <select
            value={newRule.channel}
            onChange={(event) => setNewRule((current) => ({ ...current, channel: event.target.value as 'browser' | 'webhook' }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="browser">Browser</option>
            <option value="webhook">Webhook</option>
          </select>
          <input
            value={newRule.webhook_url}
            onChange={(event) => setNewRule((current) => ({ ...current, webhook_url: event.target.value }))}
            placeholder="Webhook URL"
            disabled={newRule.channel !== 'webhook'}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <button
          onClick={() => createRule.mutate()}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
        >
          Add Rule
        </button>
      </section>
    </div>
  )
}
