package config

import (
	"sync"
	"time"
)

type RuntimeConfig struct {
	mu sync.RWMutex

	path string
	cfg  *Config

	telemetryUpdates chan time.Duration
	softwareUpdates  chan time.Duration
	eventUpdates     chan time.Duration
}

func NewRuntimeConfig(cfg *Config, path string) *RuntimeConfig {
	return &RuntimeConfig{
		path:             path,
		cfg:              cfg,
		telemetryUpdates: make(chan time.Duration, 1),
		softwareUpdates:  make(chan time.Duration, 1),
		eventUpdates:     make(chan time.Duration, 1),
	}
}

func (r *RuntimeConfig) Config() *Config {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.cfg
}

func (r *RuntimeConfig) TelemetryInterval() time.Duration {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return time.Duration(maxInt(r.cfg.Collect.TelemetryIntervalSecs, 1)) * time.Second
}

func (r *RuntimeConfig) SoftwareInterval() time.Duration {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return time.Duration(maxInt(r.cfg.Collect.SoftwareScanIntervalM, 1)) * time.Minute
}

func (r *RuntimeConfig) EventInterval() time.Duration {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return time.Duration(maxInt(r.cfg.Collect.EventPollIntervalSecs, 1)) * time.Second
}

func (r *RuntimeConfig) TelemetryUpdates() <-chan time.Duration { return r.telemetryUpdates }
func (r *RuntimeConfig) SoftwareUpdates() <-chan time.Duration  { return r.softwareUpdates }
func (r *RuntimeConfig) EventUpdates() <-chan time.Duration     { return r.eventUpdates }

func (r *RuntimeConfig) Apply(telemetrySecs, softwareMins, eventSecs int) error {
	r.mu.Lock()
	if telemetrySecs > 0 {
		r.cfg.Collect.TelemetryIntervalSecs = telemetrySecs
	}
	if softwareMins > 0 {
		r.cfg.Collect.SoftwareScanIntervalM = softwareMins
	}
	if eventSecs > 0 {
		r.cfg.Collect.EventPollIntervalSecs = eventSecs
	}
	err := Save(r.path, r.cfg)
	telemetryInterval := time.Duration(maxInt(r.cfg.Collect.TelemetryIntervalSecs, 1)) * time.Second
	softwareInterval := time.Duration(maxInt(r.cfg.Collect.SoftwareScanIntervalM, 1)) * time.Minute
	eventInterval := time.Duration(maxInt(r.cfg.Collect.EventPollIntervalSecs, 1)) * time.Second
	r.mu.Unlock()
	if err != nil {
		return err
	}

	if telemetrySecs > 0 {
		pushDuration(r.telemetryUpdates, telemetryInterval)
	}
	if softwareMins > 0 {
		pushDuration(r.softwareUpdates, softwareInterval)
	}
	if eventSecs > 0 {
		pushDuration(r.eventUpdates, eventInterval)
	}

	return nil
}

func pushDuration(ch chan time.Duration, value time.Duration) {
	select {
	case <-ch:
	default:
	}
	select {
	case ch <- value:
	default:
	}
}

func maxInt(value, minimum int) int {
	if value < minimum {
		return minimum
	}
	return value
}
