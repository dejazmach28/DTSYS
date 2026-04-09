import api from './client'
import type { Alert } from '../types'

export const alertsApi = {
  list: (params?: { device_id?: string; resolved?: boolean; severity?: string; limit?: number }) =>
    api.get<Alert[]>('/alerts', { params }).then((r) => r.data),
  resolve: (id: string) =>
    api.post<Alert>(`/alerts/${id}/resolve`).then((r) => r.data),
}
