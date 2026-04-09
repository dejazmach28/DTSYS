import api from './client'
import type { InventoryDevice } from '../types'

export const inventoryApi = {
  list: (params?: { location?: string; assigned_to?: string; warranty_expiring_days?: number }) =>
    api.get<InventoryDevice[]>('/inventory', { params }).then((r) => r.data),
  exportCsv: () => api.get('/inventory/export.csv', { responseType: 'blob' }).then((r) => r.data as Blob),
}
