import api from './client'
import type { SoftwareSearchResult } from '../types'

export const softwareApi = {
  search: (q: string) =>
    api.get<SoftwareSearchResult[]>('/software/search', { params: { q } }).then((r) => r.data),
}
