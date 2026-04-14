import api from './client'

export interface Command {
  id: string
  device_id: string
  command_type: string
  status: 'pending' | 'sent' | 'running' | 'completed' | 'failed' | 'timeout'
  output: string | null
  exit_code: number | null
  payload: Record<string, unknown>
  created_at: string
  completed_at: string | null
}

export const commandsApi = {
  list: (deviceId: string, limit = 20): Promise<Command[]> =>
    api.get('/commands', { params: { device_id: deviceId, limit } }).then((r) => r.data),

  dispatch: (deviceId: string, commandType: string, payload: Record<string, unknown> = {}): Promise<Command> =>
    api.post('/commands', { device_id: deviceId, command_type: commandType, payload }).then((r) => r.data),

  get: (commandId: string): Promise<Command> =>
    api.get(`/commands/${commandId}`).then((r) => r.data),
}

export const COMMAND_LIBRARY: Array<{ label: string; type: string; description: string; dangerous?: boolean }> = [
  { label: 'Check Updates', type: 'check_updates', description: 'Check for available software updates' },
  { label: 'Sync Time', type: 'sync_time', description: 'Synchronize system clock via NTP' },
  { label: 'Collect Inventory', type: 'collect_inventory', description: 'Refresh software inventory' },
  { label: 'Screenshot', type: 'screenshot', description: 'Capture current screen state' },
  { label: 'List Processes', type: 'list_processes', description: 'Fetch running process list' },
  { label: 'Network Info', type: 'network_info', description: 'Refresh network interface data' },
  { label: 'Reboot', type: 'reboot', description: 'Reboot the device', dangerous: true },
  { label: 'Shutdown', type: 'shutdown', description: 'Shut down the device', dangerous: true },
]
