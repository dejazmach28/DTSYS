import { useState, useCallback } from 'react'
import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { getServerUrl, saveTokens, saveServerUrl, clearTokens, getAccessToken } from '../api/client'

export function useAuth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = useCallback(async (serverUrl: string, username: string, password: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const base = serverUrl.replace(/\/$/, '')
      await saveServerUrl(base)
      const resp = await axios.post(`${base}/api/v1/auth/login`, { username, password }, { timeout: 10000 })
      await saveTokens(resp.data.access_token, resp.data.refresh_token)
      await SecureStore.setItemAsync('username', username)
      return true
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Login failed')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await clearTokens()
    await SecureStore.deleteItemAsync('username')
  }, [])

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const token = await getAccessToken()
    return Boolean(token)
  }, [])

  return { login, logout, checkAuth, loading, error }
}
