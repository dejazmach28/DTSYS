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
  tags: string[]
  is_online: boolean
}

export interface DeviceGroup {
  id: string
  name: string
  description: string | null
  color: string
  member_count?: number
  created_at?: string | null
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

export interface DeviceConfig {
  telemetry_interval_secs: number
  software_scan_interval_m: number
  event_poll_interval_secs: number
}

export interface DeviceConfigResponse {
  device_id: string
  config: DeviceConfig
  updated_at: string | null
}

export interface ScheduledCommand {
  id: string
  device_id: string | null
  command_type: string
  payload: Record<string, unknown>
  cron_expression: string
  is_enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
  created_by: string | null
  created_at: string | null
}

export interface NotificationRule {
  id: string
  alert_type: string
  severity_min: 'info' | 'warning' | 'critical'
  channel: 'browser' | 'webhook'
  webhook_url: string | null
  is_enabled: boolean
  created_at: string | null
}

export interface AuditLogEntry {
  id: string
  timestamp: string | null
  user_id: string | null
  username: string
  action: string
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  details: Record<string, unknown> | null
}

export interface AuthConfig {
  mode: 'Local' | 'LDAP'
  ldap_enabled: boolean
  ldap_server: string
  ldap_port: number
  ldap_use_ssl: boolean
  ldap_base_dn: string
  ldap_user_filter: string
  ldap_admin_group_dn: string
}

export interface PendingSoftwareUpdate {
  software_name: string
  current_versions: string[]
  affected_device_ids: string[]
  affected_count: number
}

export interface SoftwareSearchResult {
  name: string
  device_count: number
  versions: string[]
}

export interface ScreenshotResponse {
  image_b64: string | null
  captured_at: string | null
  width?: number | null
  height?: number | null
  error?: string | null
}

export interface ActivityEvent {
  device_id: string
  device_hostname: string
  event_type: 'crash' | 'error' | 'warning' | 'info'
  message: string
  source?: string | null
  time: string
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
