//go:build darwin

package collector

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/dtsys/agent/internal/transport"
)

// CollectEvents returns recent DiagnosticReports entries from macOS.
func CollectEvents(since time.Time) ([]transport.EventData, error) {
	home, _ := os.UserHomeDir()
	dirs := []string{
		"/Library/Logs/DiagnosticReports",
		filepath.Join(home, "Library/Logs/DiagnosticReports"),
	}

	var events []transport.EventData
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, err
		}

		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}

			name := entry.Name()
			ext := strings.ToLower(filepath.Ext(name))
			if ext != ".crash" && ext != ".spin" && ext != ".hang" && ext != ".ips" {
				continue
			}

			info, err := entry.Info()
			if err != nil || !info.ModTime().After(since) {
				continue
			}

			event, err := parseDarwinDiagnosticReport(filepath.Join(dir, name), ext)
			if err != nil {
				continue
			}
			events = append(events, event)
		}
	}

	return events, nil
}

func parseDarwinDiagnosticReport(path, ext string) (transport.EventData, error) {
	file, err := os.Open(path)
	if err != nil {
		return transport.EventData{}, err
	}
	defer file.Close()

	eventType := "error"
	switch ext {
	case ".crash":
		eventType = "crash"
	case ".hang", ".spin":
		eventType = "warning"
	}

	base := strings.ToLower(filepath.Base(path))
	if strings.Contains(base, "panic") {
		eventType = "crash"
	}

	scanner := bufio.NewScanner(file)
	process := ""
	exceptionType := ""
	terminationReason := ""
	lines := make([]string, 0, 60)
	for i := 0; scanner.Scan() && i < 60; i++ {
		line := strings.TrimSpace(scanner.Text())
		lines = append(lines, line)
		switch {
		case strings.HasPrefix(line, "Process:"):
			process = strings.TrimSpace(strings.TrimPrefix(line, "Process:"))
		case strings.HasPrefix(line, "Exception Type:"):
			exceptionType = strings.TrimSpace(strings.TrimPrefix(line, "Exception Type:"))
		case strings.HasPrefix(line, "Termination Reason:"):
			terminationReason = strings.TrimSpace(strings.TrimPrefix(line, "Termination Reason:"))
		}
	}

	source := process
	if source == "" {
		if strings.Contains(base, "panic") {
			source = "kernel"
		} else {
			source = filepath.Base(path)
		}
	}

	messageParts := []string{filepath.Base(path)}
	if process != "" {
		messageParts = append(messageParts, fmt.Sprintf("Process: %s", process))
	}
	if exceptionType != "" {
		messageParts = append(messageParts, fmt.Sprintf("Exception Type: %s", exceptionType))
	}
	if terminationReason != "" {
		messageParts = append(messageParts, fmt.Sprintf("Termination Reason: %s", terminationReason))
	}

	return transport.EventData{
		EventType: eventType,
		Source:    source,
		Message:   strings.Join(messageParts, " | "),
		RawData: map[string]interface{}{
			"path":  path,
			"lines": lines,
		},
	}, nil
}
