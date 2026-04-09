import api from './client'
import type { Alert } from '../types'

export const alertsApi = {
  list: (params?: { device_id?: string; resolved?: boolean; severity?: string; limit?: number }) =>
    api.get<Alert[]>('/alerts', { params }).then((r) => r.data),
  listPage: (params?: { device_id?: string; resolved?: boolean; severity?: string; limit?: number; skip?: number }) =>
    api.get<Alert[]>('/alerts', { params }).then((r) => ({
      data: r.data,
      total: Number(r.headers['x-total-count'] ?? r.data.length),
    })),
  resolve: (id: string) =>
    api.post<Alert>(`/alerts/${id}/resolve`).then((r) => r.data),
}
