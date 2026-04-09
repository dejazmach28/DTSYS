import api from './client'
import type {
  AuditLogEntry,
  AuthConfig,
  LiveConnectionsResponse,
  StorageCleanupResponse,
  StorageStatsResponse,
  User,
} from '../types'

export const adminApi = {
  users: () => api.get<User[]>('/admin/users').then((r) => r.data),
  createUser: (body: { username: string; password: string; role: 'admin' | 'viewer' }) =>
    api.post('/admin/users', body).then((r) => r.data),
  updateUser: (id: string, body: { role?: 'admin' | 'viewer'; is_active?: boolean }) =>
    api.patch(`/admin/users/${id}`, body).then((r) => r.data),
  resetUserPassword: (id: string, password: string) =>
    api.patch(`/admin/users/${id}/password`, { password }).then((r) => r.data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then((r) => r.data),
  auditLog: (params?: { action?: string; limit?: number }) =>
    api.get<AuditLogEntry[]>('/admin/audit-log', { params }).then((r) => r.data),
  auditLogPage: (params?: { action?: string; limit?: number; skip?: number }) =>
    api.get<AuditLogEntry[]>('/admin/audit-log', { params }).then((r) => ({
      data: r.data,
      total: Number(r.headers['x-total-count'] ?? r.data.length),
    })),
  authConfig: () => api.get<AuthConfig>('/admin/auth-config').then((r) => r.data),
  connections: () => api.get<LiveConnectionsResponse>('/admin/connections').then((r) => r.data),
  storageStats: () => api.get<StorageStatsResponse>('/admin/storage-stats').then((r) => r.data),
  cleanup: () => api.post<StorageCleanupResponse>('/admin/cleanup').then((r) => r.data),
}
