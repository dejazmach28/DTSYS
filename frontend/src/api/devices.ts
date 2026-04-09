import api from './client'
import type { Device, DeviceConfig, DeviceConfigResponse, DeviceNetworkResponse } from '../types'

export const devicesApi = {
  list: (tag?: string) => api.get<Device[]>('/devices', { params: tag ? { tag } : undefined }).then((r) => r.data),
  get: (id: string) => api.get<Device>(`/devices/${id}`).then((r) => r.data),
  network: (id: string) => api.get<DeviceNetworkResponse>(`/devices/${id}/network`).then((r) => r.data),
  config: (id: string) => api.get<DeviceConfigResponse>(`/devices/${id}/config`).then((r) => r.data),
  updateConfig: (id: string, config: DeviceConfig) =>
    api.post(`/devices/${id}/config`, config).then((r) => r.data),
  update: (id: string, data: Partial<Pick<Device, 'label' | 'notes' | 'tags'>>) =>
    api.patch(`/devices/${id}`, data).then((r) => r.data),
  revoke: (id: string) => api.delete(`/devices/${id}`).then((r) => r.data),
}
