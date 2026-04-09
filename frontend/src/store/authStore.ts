import { create } from 'zustand'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  username: string | null
  role: string | null
  isAuthenticated: boolean
  login: (accessToken: string, refreshToken: string, username: string, role: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  username: localStorage.getItem('username'),
  role: localStorage.getItem('role'),
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: (accessToken, refreshToken, username, role) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('username', username)
    localStorage.setItem('role', role)
    set({ accessToken, refreshToken, username, role, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('username')
    localStorage.removeItem('role')
    set({ accessToken: null, refreshToken: null, username: null, role: null, isAuthenticated: false })
  },
}))
