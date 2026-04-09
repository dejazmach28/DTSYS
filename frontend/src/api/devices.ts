import api from './client'
import type { Device } from '../types'

export const devicesApi = {
  list: () => api.get<Device[]>('/devices').then((r) => r.data),
  get: (id: string) => api.get<Device>(`/devices/${id}`).then((r) => r.data),
  update: (id: string, data: Partial<Pick<Device, 'label' | 'notes'>>) =>
    api.patch(`/devices/${id}`, data).then((r) => r.data),
  revoke: (id: string) => api.delete(`/devices/${id}`).then((r) => r.data),
}
