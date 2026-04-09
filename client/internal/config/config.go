package config

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"
)

type Config struct {
	Server  ServerConfig  `toml:"server"`
	Agent   AgentConfig   `toml:"agent"`
	Collect CollectConfig `toml:"collect"`
}

type ServerConfig struct {
	URL             string `toml:"url"`              // e.g. "wss://dtsys.example.com"
	EnrollmentToken string `toml:"enrollment_token"` // used only on first registration
}

type AgentConfig struct {
	DeviceID string `toml:"device_id"` // set after registration
	APIKey   string `toml:"api_key"`   // set after registration
}

type CollectConfig struct {
	TelemetryIntervalSecs int `toml:"telemetry_interval_secs"`  // default 60
	SoftwareScanIntervalM int `toml:"software_scan_interval_m"` // default 60 (minutes)
	EventPollIntervalSecs int `toml:"event_poll_interval_secs"` // default 120
}

func Load(path string) (*Config, error) {
	cfg := &Config{
		Collect: CollectConfig{
			TelemetryIntervalSecs: 60,
			SoftwareScanIntervalM: 60,
			EventPollIntervalSecs: 120,
		},
	}

	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, fmt.Errorf("config file not found: %s", path)
	}

	if _, err := toml.DecodeFile(path, cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	if cfg.Server.URL == "" {
		return nil, fmt.Errorf("server.url is required in config")
	}

	return cfg, nil
}

func Save(path string, cfg *Config) error {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("cannot write config: %w", err)
	}
	defer f.Close()

	enc := toml.NewEncoder(f)
	return enc.Encode(cfg)
}
