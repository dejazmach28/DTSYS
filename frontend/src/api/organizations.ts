import api from './client'

export interface Org {
  id: string
  name: string
  slug: string
  role: string
  active: boolean
}

export interface OrgMember {
  user_id: string
  username: string
  role: string
}

export const orgsApi = {
  list: () => api.get<Org[]>('/organizations').then((r) => r.data),

  create: (body: { name: string; slug: string }) =>
    api.post<{ id: string; name: string; slug: string }>('/organizations', body).then((r) => r.data),

  update: (orgId: string, body: { name: string }) =>
    api.patch<{ id: string; name: string }>(`/organizations/${orgId}`, body).then((r) => r.data),

  delete: (orgId: string) =>
    api.delete(`/organizations/${orgId}`).then((r) => r.data),

  listMembers: (orgId: string) =>
    api.get<OrgMember[]>(`/organizations/${orgId}/members`).then((r) => r.data),

  inviteMember: (orgId: string, body: { username: string; role: string }) =>
    api.post(`/organizations/${orgId}/members`, body).then((r) => r.data),

  removeMember: (orgId: string, userId: string) =>
    api.delete(`/organizations/${orgId}/members/${userId}`).then((r) => r.data),

  updateMember: (orgId: string, userId: string, body: { role: string }) =>
    api.patch(`/organizations/${orgId}/members/${userId}`, body).then((r) => r.data),

  switch: (orgId: string) =>
    api.post<{ access_token: string; refresh_token: string }>(`/organizations/${orgId}/switch`).then((r) => r.data),
}
