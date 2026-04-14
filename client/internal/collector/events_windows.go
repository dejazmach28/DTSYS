//go:build windows

package collector

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/dtsys/agent/internal/transport"
)

type EventFilter struct{}

type windowsEventRecord struct {
	Source    string `json:"source"`
	EventID   int    `json:"event_id"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
	Provider  string `json:"provider"`
}

// CollectWindowsEvents reads Application and System logs using Get-WinEvent.
func CollectWindowsEvents(ctx context.Context, since time.Time, _ *EventFilter) ([]transport.EventData, error) {
	// Build the script using a regular string to avoid backtick conflicts in raw string literals.
	// PowerShell backtick escapes (`r`n) must be represented as their Unicode equivalents here.
	script := fmt.Sprintf(
		"$since = [DateTime]::Parse('%s')\n"+
			"$logs = @('Application', 'System')\n"+
			"$events = @()\n"+
			"foreach ($log in $logs) {\n"+
			"    try {\n"+
			"        $entries = Get-WinEvent -FilterHashtable @{ LogName = $log; Level = 1,2,3; StartTime = $since } -ErrorAction SilentlyContinue | Select-Object -First 50\n"+
			"        foreach ($e in $entries) {\n"+
			"            $events += @{ source = $log; event_id = $e.Id; level = $e.LevelDisplayName; message = ($e.Message -replace \"`r`n\", ' ' -replace \"`n\", ' '); timestamp = $e.TimeCreated.ToString('o'); provider = $e.ProviderName }\n"+
			"        }\n"+
			"    } catch {}\n"+
			"}\n"+
			"$events | ConvertTo-Json -Compress -Depth 2\n",
		since.UTC().Format(time.RFC3339),
	)

	cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
	out, err := cmd.Output()
	if err != nil || len(out) == 0 {
		return nil, nil
	}

	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" || trimmed == "null" {
		return nil, nil
	}

	var records []windowsEventRecord
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
		source := strings.TrimSpace(record.Provider)
		if source == "" {
			source = strings.TrimSpace(record.Source)
		}
		event := transport.EventData{
			EventType: classifyWindowsEvent(record.Level, record.Provider, record.Message),
			Source:    source,
			Message:   strings.TrimSpace(record.Message),
			RawData: map[string]interface{}{
				"time_created": record.Timestamp,
				"event_id":     record.EventID,
				"level":        record.Level,
				"log":          record.Source,
			},
		}
		if shouldSkipEvent(event.Source, event.Message) {
			continue
		}
		events = append(events, event)
	}

	dumpEvents, err := collectMinidumps(since)
	if err == nil {
		events = append(events, dumpEvents...)
	}

	return ApplyEventRateLimit(events), nil
}

// CollectEvents wraps CollectWindowsEvents with background context.
func CollectEvents(since time.Time) ([]transport.EventData, error) {
	return CollectWindowsEvents(context.Background(), since, nil)
}

func collectMinidumps(since time.Time) ([]transport.EventData, error) {
	systemRoot := os.Getenv("SystemRoot")
	if systemRoot == "" {
		systemRoot = `C:\Windows`
	}
	dumpDir := filepath.Join(systemRoot, "Minidump")
	entries, err := os.ReadDir(dumpDir)
	if err != nil {
		return nil, err
	}
	events := make([]transport.EventData, 0)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".dmp") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.ModTime().After(since) {
			events = append(events, transport.EventData{
				EventType: "crash",
				Source:    "windows/minidump",
				Message:   fmt.Sprintf("Crash dump detected: %s", entry.Name()),
				RawData: map[string]interface{}{
					"filename":  entry.Name(),
					"timestamp": info.ModTime().UTC().Format(time.RFC3339),
				},
			})
		}
	}
	return events, nil
}

func classifyWindowsEvent(level, provider, message string) string {
	if containsAnyFoldWindows(level, "critical") ||
		containsAnyFoldWindows(provider, "bugcheck", "application error", "windows error reporting") ||
		containsAnyFoldWindows(message, "faulting application", "stopped working") {
		return "crash"
	}
	if containsAnyFoldWindows(level, "warning") {
		return "warning"
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
