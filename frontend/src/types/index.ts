export interface Device {
  id: string
  hostname: string
  os_type: 'windows' | 'linux' | 'macos'
  os_version: string | null
  arch: string | null
  ip_address: string | null
  status: 'online' | 'offline' | 'alert'
  last_seen: string | null
  enrolled_at: string
  label: string | null
  notes: string | null
  is_online: boolean
}

export interface Metric {
  time: string
  cpu_percent: number | null
  ram_percent: number | null
  disk_percent: number | null
  cpu_temp: number | null
  uptime_secs: number | null
  ram_total_mb: number | null
  ram_used_mb: number | null
  disk_total_gb: number | null
  disk_used_gb: number | null
}

export interface SoftwarePackage {
  id: string
  name: string
  version: string | null
  install_date: string | null
  update_available: boolean
  latest_version: string | null
  last_scanned: string
}

export interface Event {
  id: string
  time: string
  event_type: 'crash' | 'error' | 'warning' | 'info'
  source: string | null
  message: string
}

export interface Command {
  id: string
  command_type: string
  payload: Record<string, unknown>
  status: 'pending' | 'sent' | 'running' | 'completed' | 'failed' | 'timeout'
  exit_code: number | null
  output: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface Alert {
  id: string
  device_id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  is_resolved: boolean
  created_at: string
  resolved_at: string | null
}

export interface NetworkInterface {
  id: string
  interface_name: string
  mac_address: string | null
  ipv4: string[]
  ipv6: string[]
  is_up: boolean
  mtu: number | null
  updated_at: string | null
}

export interface DeviceNetworkResponse {
  interfaces: NetworkInterface[]
}

export interface User {
  id: string
  username: string
  role: 'admin' | 'viewer'
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}
