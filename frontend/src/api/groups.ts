import api from './client'
import type { Device, DeviceGroup } from '../types'

export const groupsApi = {
  list: () => api.get<DeviceGroup[]>('/groups').then((r) => r.data),
  create: (data: { name: string; description?: string | null; color: string }) =>
    api.post<DeviceGroup>('/groups', data).then((r) => r.data),
  deviceGroups: (deviceId: string) =>
    api.get<DeviceGroup[]>(`/groups/device/${deviceId}`).then((r) => r.data),
  devices: (groupId: string) =>
    api.get<Device[]>(`/groups/${groupId}/devices`).then((r) => r.data),
  addDevices: (groupId: string, device_ids: string[]) =>
    api.post(`/groups/${groupId}/devices`, { device_ids }).then((r) => r.data),
  removeDevice: (groupId: string, deviceId: string) =>
    api.delete(`/groups/${groupId}/devices/${deviceId}`).then((r) => r.data),
}
