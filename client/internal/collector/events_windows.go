//go:build windows

package collector

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/dtsys/agent/internal/transport"
)

type windowsEventRecord struct {
	TimeCreated  string `json:"TimeCreated"`
	ProviderName string `json:"ProviderName"`
	ID           int    `json:"Id"`
	LevelDisplay string `json:"LevelDisplayName"`
	Message      string `json:"Message"`
}

// CollectEvents returns recent Windows error and crash events from the Event Log.
func CollectEvents(since time.Time) ([]transport.EventData, error) {
	script := fmt.Sprintf(`$since = [DateTime]::Parse('%s')
$events = Get-WinEvent -FilterHashtable @{LogName=@('System','Application'); Level=@(1,2); StartTime=$since} -MaxEvents 100 |
	Select-Object TimeCreated, ProviderName, Id, LevelDisplayName, Message
$events | ConvertTo-Json -Compress`, since.Format("2006-01-02T15:04:05"))

	out, err := exec.Command("powershell", "-NoProfile", "-Command", script).CombinedOutput()
	if err != nil {
		return nil, err
	}

	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" || trimmed == "null" {
		return nil, nil
	}

	records := make([]windowsEventRecord, 0)
	if strings.HasPrefix(trimmed, "[") {
		if err := json.Unmarshal(out, &records); err != nil {
			return nil, err
		}
	} else {
		var record windowsEventRecord
		if err := json.Unmarshal(out, &record); err != nil {
			return nil, err
		}
		records = append(records, record)
	}

	events := make([]transport.EventData, 0, len(records))
	for _, record := range records {
		event := transport.EventData{
			EventType: classifyWindowsEvent(record.ProviderName, record.Message),
			Source:    strings.TrimSpace(record.ProviderName),
			Message:   strings.TrimSpace(record.Message),
			RawData: map[string]interface{}{
				"time_created": record.TimeCreated,
				"event_id":     record.ID,
				"level":        record.LevelDisplay,
			},
		}
		if shouldSkipEvent(event.Source, event.Message) {
			continue
		}
		events = append(events, event)
	}

	return events, nil
}

func classifyWindowsEvent(provider, message string) string {
	if containsAnyFoldWindows(provider, "bugcheck", "application error", "windows error reporting") ||
		containsAnyFoldWindows(message, "faulting application", "stopped working") {
		return "crash"
	}
	return "error"
}

func containsAnyFoldWindows(value string, needles ...string) bool {
	lower := strings.ToLower(value)
	for _, needle := range needles {
		if strings.Contains(lower, strings.ToLower(needle)) {
			return true
		}
	}
	return false
}
