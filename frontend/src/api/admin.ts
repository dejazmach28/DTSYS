import api from './client'
import type { AuditLogEntry, AuthConfig } from '../types'

export const adminApi = {
  auditLog: (params?: { action?: string; limit?: number }) =>
    api.get<AuditLogEntry[]>('/admin/audit-log', { params }).then((r) => r.data),
  authConfig: () => api.get<AuthConfig>('/admin/auth-config').then((r) => r.data),
}
