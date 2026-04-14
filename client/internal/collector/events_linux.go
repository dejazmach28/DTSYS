//go:build linux

package collector

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/dtsys/agent/internal/transport"
)

var linuxCrashMarkers = []string{
	"kernel panic",
	"panic",
	"oops",
	"segfault",
	"oom-killer",
	"out of memory",
}

// CollectEvents returns recent Linux error, warning, and crash events.
func CollectEvents(since time.Time) ([]transport.EventData, error) {
	var (
		events         []transport.EventData
		seen           = make(map[string]struct{})
		atLeastOneRead bool
		errs           []string
	)

	addEvent := func(event transport.EventData) {
		if shouldSkipEvent(event.Source, event.Message) {
			return
		}
		key := event.EventType + "|" + event.Source + "|" + event.Message
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		events = append(events, event)
	}

	if out, err := exec.Command("journalctl", "--no-pager", "-o", "short-iso", "-p", "err", "-S", since.Format("2006-01-02 15:04:05"), "--lines", "200").CombinedOutput(); err == nil {
		atLeastOneRead = true
		trimmed := strings.TrimSpace(string(out))
		if trimmed == "" || trimmed == "-- No entries --" {
			// No entries is not an error; just return empty events.
		} else {
			scanner := bufio.NewScanner(bytes.NewReader(out))
			for scanner.Scan() {
				line := strings.TrimSpace(scanner.Text())
				if line == "" {
					continue
				}
				addEvent(parseLinuxJournalLine(line))
			}
		}
	} else {
		errs = append(errs, fmt.Sprintf("journalctl: %v", err))
	}

	if out, err := exec.Command("dmesg", "--level=err,crit,alert,emerg").CombinedOutput(); err == nil {
		atLeastOneRead = true
		appendLinuxKernelEvents(addEvent, out, false)
	} else {
		errs = append(errs, fmt.Sprintf("dmesg-filtered: %v", err))
		if out, fallbackErr := exec.Command("dmesg").CombinedOutput(); fallbackErr == nil {
			atLeastOneRead = true
			appendLinuxKernelEvents(addEvent, out, true)
		} else {
			errs = append(errs, fmt.Sprintf("dmesg: %v", fallbackErr))
		}
	}

	for _, candidate := range []string{"/var/log/syslog", "/var/log/messages"} {
		if _, err := os.Stat(candidate); err != nil {
			continue
		}
		out, err := exec.Command("tail", "-n", "200", candidate).CombinedOutput()
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", candidate, err))
			continue
		}
		atLeastOneRead = true
		scanner := bufio.NewScanner(bytes.NewReader(out))
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if !linuxFallbackLogMatch(line) {
				continue
			}
			addEvent(transport.EventData{
				EventType: classifyLinuxEvent(line),
				Source:    filepath.Base(candidate),
				Message:   line,
				RawData: map[string]interface{}{
					"log_file": candidate,
				},
			})
		}
	}

	if len(events) > 0 {
		return events, nil
	}
	if atLeastOneRead {
		return nil, nil
	}
	return nil, fmt.Errorf("event collection failed: %s", strings.Join(errs, "; "))
}

func parseLinuxJournalLine(line string) transport.EventData {
	fields := strings.Fields(line)
	source := "journal"
	if len(fields) >= 4 {
		source = strings.TrimSuffix(fields[3], ":")
	} else if len(fields) >= 3 {
		source = strings.TrimSuffix(fields[2], ":")
	}

	return transport.EventData{
		EventType: classifyLinuxEvent(line),
		Source:    source,
		Message:   line,
		RawData: map[string]interface{}{
			"collector": "journalctl",
		},
	}
}

func appendLinuxKernelEvents(add func(transport.EventData), out []byte, crashOnly bool) {
	scanner := bufio.NewScanner(bytes.NewReader(out))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if crashOnly && !containsAnyFold(line, linuxCrashMarkers...) {
			continue
		}
		add(transport.EventData{
			EventType: classifyLinuxEvent(line),
			Source:    "kernel",
			Message:   line,
			RawData: map[string]interface{}{
				"collector": "dmesg",
			},
		})
	}
}

func linuxFallbackLogMatch(line string) bool {
	return containsAnyFold(line, "error", "critical", "fatal", "panic", "oom", "segfault", "crash")
}

func classifyLinuxEvent(line string) string {
	if containsAnyFold(line, linuxCrashMarkers...) {
		return "crash"
	}
	if containsAnyFold(line, "warning", "warn") {
		return "warning"
	}
	return "error"
}

func containsAnyFold(value string, needles ...string) bool {
	lower := strings.ToLower(value)
	for _, needle := range needles {
		if strings.Contains(lower, strings.ToLower(needle)) {
			return true
		}
	}
	return false
}
