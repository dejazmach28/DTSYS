import { useState } from 'react'
import api from '../api/client'
import { Copy, Plus, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function Settings() {
  const { role } = useAuthStore()
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer' })
  const [token, setToken] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/admin/users', newUser)
      setMsg('User created successfully')
      setNewUser({ username: '', password: '', role: 'viewer' })
    } catch {
      setMsg('Failed to create user')
    }
  }

  const generateToken = async () => {
    const res = await api.post('/admin/enrollment-tokens')
    setToken(res.data.enrollment_token)
  }

  if (role !== 'admin') {
    return (
      <div className="text-gray-500 text-sm p-4">
        Admin access required to view settings.
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Administration</p>
      </div>

      {/* Enrollment Token */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-1">Enrollment Token</h2>
        <p className="text-xs text-gray-500 mb-4">
          Generate a one-time token to register a new device agent.
        </p>
        {token ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-800 text-green-400 font-mono text-sm px-3 py-2 rounded-lg">
              {token}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(token)}
              className="text-gray-400 hover:text-gray-100 transition-colors"
            >
              <Copy size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={generateToken}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            Generate Token
          </button>
        )}
      </section>

      {/* Create User */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-1">Create User</h2>
        <p className="text-xs text-gray-500 mb-4">Add a new dashboard user account.</p>

        {msg && (
          <div className="mb-3 text-xs text-blue-400 bg-blue-400/10 rounded px-3 py-2">{msg}</div>
        )}

        <form onSubmit={createUser} className="space-y-3">
          <input
            value={newUser.username}
            onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
            placeholder="Username"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
          />
          <input
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
            placeholder="Password"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
          />
          <select
            value={newUser.role}
            onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Create User
          </button>
        </form>
      </section>
    </div>
  )
}
