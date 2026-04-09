import api from './client'
import type { ScheduledCommand } from '../types'

export const scheduledCommandsApi = {
  list: () => api.get<ScheduledCommand[]>('/scheduled-commands').then((r) => r.data),
  create: (data: {
    device_id: string | null
    command_type: string
    payload?: Record<string, unknown>
    cron_expression: string
    is_enabled?: boolean
  }) => api.post<ScheduledCommand>('/scheduled-commands', data).then((r) => r.data),
  update: (id: string, data: Partial<{
    device_id: string | null
    command_type: string
    payload: Record<string, unknown>
    cron_expression: string
    is_enabled: boolean
  }>) => api.patch<ScheduledCommand>(`/scheduled-commands/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/scheduled-commands/${id}`).then((r) => r.data),
}
