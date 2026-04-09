import api from './client'

export const tagsApi = {
  list: () => api.get<string[]>('/tags').then((r) => r.data),
}
