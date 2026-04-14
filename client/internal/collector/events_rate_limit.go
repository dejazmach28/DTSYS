// Package collector provides system telemetry and event collection helpers.
package collector

import (
	"fmt"
	"sync"
	"time"

	"github.com/dtsys/agent/internal/transport"
)

type eventRateLimiter struct {
	maxEvents   int
	window      time.Duration
	windowStart time.Time
	count       int
	dropped     int
	summarySent bool
}

var (
	rateMu  sync.Mutex
	limiter = eventRateLimiter{
		maxEvents: 20,
		window:    30 * time.Second,
	}
)

// ConfigureEventRateLimit sets the global event rate limit.
func ConfigureEventRateLimit(maxEvents int, windowSeconds int) {
	rateMu.Lock()
	defer rateMu.Unlock()

	if maxEvents > 0 {
		limiter.maxEvents = maxEvents
	}
	if windowSeconds > 0 {
		limiter.window = time.Duration(windowSeconds) * time.Second
	}
	limiter.windowStart = time.Time{}
	limiter.count = 0
	limiter.dropped = 0
	limiter.summarySent = false
}

// ApplyEventRateLimit drops excess events and emits a summary event once per window.
func ApplyEventRateLimit(events []transport.EventData) []transport.EventData {
	if len(events) == 0 {
		return events
	}

	rateMu.Lock()
	defer rateMu.Unlock()

	now := time.Now()
	if limiter.windowStart.IsZero() || now.Sub(limiter.windowStart) > limiter.window {
		limiter.windowStart = now
		limiter.count = 0
		limiter.dropped = 0
		limiter.summarySent = false
	}

	allowed := limiter.maxEvents - limiter.count
	if allowed < 0 {
		allowed = 0
	}

	kept := make([]transport.EventData, 0, len(events))
	for _, ev := range events {
		if allowed > 0 {
			kept = append(kept, ev)
			limiter.count++
			allowed--
		} else {
			limiter.dropped++
		}
	}

	if limiter.dropped > 0 && !limiter.summarySent {
		kept = append(kept, transport.EventData{
			EventType: "warning",
			Source:    "agent/events",
			Message:   fmt.Sprintf("Rate limit: %d events dropped in last 30s", limiter.dropped),
			RawData: map[string]interface{}{
				"dropped": limiter.dropped,
			},
		})
		limiter.summarySent = true
	}

	return kept
}
