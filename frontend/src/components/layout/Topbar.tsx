import { useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

export default function Topbar() {
  const { username, role, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-12 bg-gray-900 border-b border-gray-800 px-6 flex items-center justify-end gap-4">
      <span className="flex items-center gap-1.5 text-sm text-gray-400">
        <User size={14} />
        <span className="text-gray-200">{username}</span>
        <span className="text-gray-600">({role})</span>
      </span>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-100 transition-colors"
      >
        <LogOut size={14} />
        Logout
      </button>
    </header>
  )
}
