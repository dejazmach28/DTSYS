import api from './client'
import type { AuthTokens } from '../types'

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthTokens>('/auth/login', { username, password }).then((r) => r.data),
  refresh: (refresh_token: string) =>
    api.post<AuthTokens>('/auth/refresh', { refresh_token }).then((r) => r.data),
}
