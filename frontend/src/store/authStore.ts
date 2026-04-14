import { create } from 'zustand'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  username: string | null
  role: string | null
  orgId: string | null
  orgName: string | null
  isAuthenticated: boolean
  login: (accessToken: string, refreshToken: string, username: string, role: string, orgId?: string, orgName?: string) => void
  logout: () => void
  setOrgContext: (orgId: string, orgName: string, accessToken: string, refreshToken: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  username: localStorage.getItem('username'),
  role: localStorage.getItem('role'),
  orgId: localStorage.getItem('org_id'),
  orgName: localStorage.getItem('org_name'),
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: (accessToken, refreshToken, username, role, orgId, orgName) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('username', username)
    localStorage.setItem('role', role)
    if (orgId) localStorage.setItem('org_id', orgId)
    if (orgName) localStorage.setItem('org_name', orgName)
    set({ accessToken, refreshToken, username, role, orgId: orgId ?? null, orgName: orgName ?? null, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('username')
    localStorage.removeItem('role')
    localStorage.removeItem('org_id')
    localStorage.removeItem('org_name')
    set({ accessToken: null, refreshToken: null, username: null, role: null, orgId: null, orgName: null, isAuthenticated: false })
  },

  setOrgContext: (orgId, orgName, accessToken, refreshToken) => {
    localStorage.setItem('org_id', orgId)
    localStorage.setItem('org_name', orgName)
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    set({ orgId, orgName, accessToken, refreshToken })
  },
}))
