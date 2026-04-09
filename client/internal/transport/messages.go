package transport

// Message types for WebSocket protocol

const (
	// Client -> Server
	MsgTypeTelemetry         = "telemetry"
	MsgTypeSoftwareInventory = "software_inventory"
	MsgTypeEventReport       = "event_report"
	MsgTypeNTPStatus         = "ntp_status"
	MsgTypeNetworkInfo       = "network_info"
	MsgTypeProcessList       = "process_list"
	MsgTypeCommandOutput     = "command_output"
	MsgTypeCommandResult     = "command_result"
	MsgTypeScreenshotResult  = "screenshot_result"

	// Server -> Client
	MsgTypeCommand           = "command"
	MsgTypeConfigUpdate      = "config_update"
	MsgTypeScreenshotRequest = "screenshot_request"
	MsgTypePing              = "ping"
	MsgTypeAck               = "ack"
)

type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data,omitempty"`
}

type TelemetryData struct {
	CPUPercent    float64 `json:"cpu_percent"`
	RAMPercent    float64 `json:"ram_percent"`
	DiskPercent   float64 `json:"disk_percent"`
	CPUTemp       float64 `json:"cpu_temp,omitempty"`
	UptimeSecs    int64   `json:"uptime_secs"`
	RAMTotalMB    float64 `json:"ram_total_mb"`
	RAMUsedMB     float64 `json:"ram_used_mb"`
	DiskTotalGB   float64 `json:"disk_total_gb"`
	DiskUsedGB    float64 `json:"disk_used_gb"`
	DiskReadMBps  float64 `json:"disk_read_mbps,omitempty"`
	DiskWriteMBps float64 `json:"disk_write_mbps,omitempty"`
	NetSentMBps   float64 `json:"net_sent_mbps,omitempty"`
	NetRecvMBps   float64 `json:"net_recv_mbps,omitempty"`
}

type SoftwarePackage struct {
	Name            string `json:"name"`
	Version         string `json:"version,omitempty"`
	UpdateAvailable bool   `json:"update_available"`
	LatestVersion   string `json:"latest_version,omitempty"`
}

type SoftwareInventoryData struct {
	Packages []SoftwarePackage `json:"packages"`
}

type EventData struct {
	EventType string                 `json:"event_type"` // crash|error|warning|info
	Source    string                 `json:"source,omitempty"`
	Message   string                 `json:"message"`
	RawData   map[string]interface{} `json:"raw_data,omitempty"`
}

type NTPStatusData struct {
	IsSynced  bool    `json:"is_synced"`
	OffsetMS  float64 `json:"offset_ms"`
	NTPServer string  `json:"ntp_server,omitempty"`
}

type NetworkInterface struct {
	Name       string   `json:"name"`
	MACAddress string   `json:"mac_address"`
	IPv4       []string `json:"ipv4"`
	IPv6       []string `json:"ipv6"`
	IsUp       bool     `json:"is_up"`
	MTU        int      `json:"mtu"`
}

type NetworkInfoData struct {
	Interfaces []NetworkInterface `json:"interfaces"`
}

type ProcessInfo struct {
	PID        int     `json:"pid"`
	Name       string  `json:"name"`
	CPUPercent float64 `json:"cpu_percent"`
	MemPercent float64 `json:"mem_percent"`
	Status     string  `json:"status"`
}

type ProcessListData struct {
	Processes []ProcessInfo `json:"processes"`
}

type CommandResultData struct {
	CommandID string `json:"command_id"`
	ExitCode  int    `json:"exit_code"`
	Output    string `json:"output"`
}

type CommandOutputData struct {
	CommandID string `json:"command_id"`
	Output    string `json:"output"`
}

type ScreenshotResultData struct {
	CommandID string `json:"command_id"`
	ImageB64  string `json:"image_b64,omitempty"`
	Width     int    `json:"width,omitempty"`
	Height    int    `json:"height,omitempty"`
	Error     string `json:"error,omitempty"`
}

type ConfigUpdateData struct {
	TelemetryIntervalSecs int `json:"telemetry_interval_secs"`
	SoftwareScanIntervalM int `json:"software_scan_interval_m"`
	EventPollIntervalSecs int `json:"event_poll_interval_secs"`
}

// Incoming from server
type IncomingCommand struct {
	CommandID   string                 `json:"command_id"`
	CommandType string                 `json:"command_type"`
	Payload     map[string]interface{} `json:"payload"`
}
