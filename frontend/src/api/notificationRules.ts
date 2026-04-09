import api from './client'
import type { NotificationRule } from '../types'

export const notificationRulesApi = {
  list: () => api.get<NotificationRule[]>('/notification-rules').then((r) => r.data),
  create: (data: {
    alert_type: string
    severity_min: string
    channel: 'browser' | 'webhook'
    webhook_url?: string | null
    is_enabled?: boolean
  }) => api.post<NotificationRule>('/notification-rules', data).then((r) => r.data),
  update: (id: string, data: Partial<NotificationRule>) =>
    api.patch<NotificationRule>(`/notification-rules/${id}`, data).then((r) => r.data),
}
