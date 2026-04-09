import api from './client'
import type { SavedCommand } from '../types'

export const savedCommandsApi = {
  list: () => api.get<SavedCommand[]>('/saved-commands').then((r) => r.data),
  create: (body: Omit<SavedCommand, 'id' | 'created_at' | 'created_by'>) =>
    api.post('/saved-commands', body).then((r) => r.data),
  update: (id: string, body: Omit<SavedCommand, 'id' | 'created_at' | 'created_by'>) =>
    api.patch(`/saved-commands/${id}`, body).then((r) => r.data),
  delete: (id: string) => api.delete(`/saved-commands/${id}`).then((r) => r.data),
}
