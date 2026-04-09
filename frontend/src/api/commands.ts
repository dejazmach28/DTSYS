import api from './client'
import type { Command } from '../types'

export const commandsApi = {
  dispatch: (deviceId: string, command_type: string, payload: Record<string, unknown> = {}) =>
    api.post(`/devices/${deviceId}/commands`, { command_type, payload }).then((r) => r.data),
  bulk: (device_ids: string[], command_type: string, payload: Record<string, unknown> = {}) =>
    api.post('/commands/bulk', { device_ids, command_type, payload }).then((r) => r.data),
  list: (deviceId: string) =>
    api.get<Command[]>(`/devices/${deviceId}/commands`).then((r) => r.data),
  get: (deviceId: string, commandId: string) =>
    api.get<Command>(`/devices/${deviceId}/commands/${commandId}`).then((r) => r.data),
}
