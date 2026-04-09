import api from './client'
import type { PendingSoftwareUpdate } from '../types'

export const softwareUpdatesApi = {
  pending: () => api.get<PendingSoftwareUpdate[]>('/software-updates/pending').then((r) => r.data),
  dispatch: (software_names: string[], device_ids: string[]) =>
    api.post('/software-updates/dispatch', { software_names, device_ids }).then((r) => r.data),
}
