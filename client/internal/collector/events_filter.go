// Package collector provides system telemetry and event collection helpers.
package collector

import (
	"regexp"
	"strings"
	"sync"
	"time"
)

type eventFilterConfig struct {
	dedupMaxEntries int
	excludePatterns []*regexp.Regexp
}

type sourceDeduper struct {
	entries map[string]time.Time
	order   []string
}

var (
	filterMu     sync.Mutex
	filterConfig = eventFilterConfig{
		dedupMaxEntries: 50,
	}
	dedupWindow = 5 * time.Minute
	dedupBySrc  = map[string]*sourceDeduper{}

	uuidRe = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)
	hexRe  = regexp.MustCompile(`(?i)\b[0-9a-f]{8,}\b`)
)

// ConfigureEventFiltering sets the event filter parameters at startup.
func ConfigureEventFiltering(dedupMax int, excludePatterns []string) error {
	filterMu.Lock()
	defer filterMu.Unlock()

	filterConfig.dedupMaxEntries = dedupMax
	filterConfig.excludePatterns = nil

	for _, pattern := range excludePatterns {
		re, err := regexp.Compile(pattern)
		if err != nil {
			return err
		}
		filterConfig.excludePatterns = append(filterConfig.excludePatterns, re)
	}
	return nil
}

func shouldSkipEvent(source, message string) bool {
	filterMu.Lock()
	defer filterMu.Unlock()

	if message == "" {
		return true
	}
	for _, re := range filterConfig.excludePatterns {
		if re.MatchString(message) {
			return true
		}
	}

	if filterConfig.dedupMaxEntries <= 0 {
		return false
	}

	now := time.Now()
	fingerprint := eventFingerprint(message)
	key := source + "|" + fingerprint

	deduper := dedupBySrc[source]
	if deduper == nil {
		deduper = &sourceDeduper{entries: map[string]time.Time{}}
		dedupBySrc[source] = deduper
	}

	for existingKey, ts := range deduper.entries {
		if now.Sub(ts) > dedupWindow {
			delete(deduper.entries, existingKey)
		}
	}

	if ts, ok := deduper.entries[key]; ok && now.Sub(ts) <= dedupWindow {
		return true
	}

	deduper.entries[key] = now
	deduper.order = append(deduper.order, key)

	if len(deduper.order) > filterConfig.dedupMaxEntries {
		excess := len(deduper.order) - filterConfig.dedupMaxEntries
		for i := 0; i < excess; i++ {
			oldest := deduper.order[0]
			deduper.order = deduper.order[1:]
			delete(deduper.entries, oldest)
		}
	}

	return false
}

func eventFingerprint(message string) string {
	normalized := strings.TrimSpace(message)
	if loc := uuidRe.FindStringIndex(normalized); loc != nil {
		normalized = normalized[:loc[0]]
	}
	normalized = hexRe.ReplaceAllString(normalized, "<hex>")
	return strings.ToLower(strings.TrimSpace(normalized))
}
