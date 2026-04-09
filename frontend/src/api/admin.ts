import api from './client'
import type { AuditLogEntry, AuthConfig, LiveConnectionsResponse } from '../types'

export const adminApi = {
  auditLog: (params?: { action?: string; limit?: number }) =>
    api.get<AuditLogEntry[]>('/admin/audit-log', { params }).then((r) => r.data),
  authConfig: () => api.get<AuthConfig>('/admin/auth-config').then((r) => r.data),
  connections: () => api.get<LiveConnectionsResponse>('/admin/connections').then((r) => r.data),
}
