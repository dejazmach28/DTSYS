import api from './client'
import type { Metric } from '../types'

export const metricsApi = {
  list: (deviceId: string, hours = 24) =>
    api.get<Metric[]>(`/devices/${deviceId}/metrics?hours=${hours}`).then((r) => r.data),
  latest: (deviceId: string) =>
    api.get<Metric | null>(`/devices/${deviceId}/metrics/latest`).then((r) => r.data),
}
