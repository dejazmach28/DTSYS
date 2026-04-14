import api from './client'

export const agentApi = {
  version: (platform = 'linux', arch = 'amd64') =>
    api.get('/agent/version', { params: { platform, arch } }).then((r) => r.data as { version: string }),
}
