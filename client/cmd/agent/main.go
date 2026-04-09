package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/dtsys/agent/internal/collector"
	"github.com/dtsys/agent/internal/config"
	"github.com/dtsys/agent/internal/executor"
	"github.com/dtsys/agent/internal/transport"
	"github.com/dtsys/agent/internal/updater"
)

const defaultConfigPath = "/etc/dtsys/agent.toml"

var AgentVersion = "0.1.0"

func main() {
	configPath := flag.String("config", defaultConfigPath, "Path to agent config file")
	flag.Parse()

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg, err := config.Load(*configPath)
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Register if not yet registered
	if cfg.Agent.DeviceID == "" || cfg.Agent.APIKey == "" {
		slog.Info("no device ID found, registering with server")
		if err := register(cfg, *configPath); err != nil {
			slog.Error("registration failed", "error", err)
			os.Exit(1)
		}
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	var wsClient *transport.Client
	wsClient = transport.NewClient(
		cfg.Server.URL,
		cfg.Agent.DeviceID,
		cfg.Agent.APIKey,
		func(cmd transport.IncomingCommand) {
			slog.Info("executing command", "type", cmd.CommandType, "id", cmd.CommandID)
			result := executor.Execute(ctx, cmd, nil)
			wsClient.SendCommandResult(result)
		},
	)

	// Start data collection loops
	go telemetryLoop(ctx, wsClient, cfg)
	go softwareLoop(ctx, wsClient, cfg)
	go ntpLoop(ctx, wsClient, cfg)
	go eventLoop(ctx, wsClient, cfg)
	go networkLoop(ctx, wsClient)
	go updateLoop(ctx, cfg)

	// Run WebSocket connection (blocks until ctx cancelled)
	wsClient.Run(ctx)
	slog.Info("agent stopped")
}

func register(cfg *config.Config, cfgPath string) error {
	osInfo, err := collector.CollectOSInfo()
	if err != nil {
		return fmt.Errorf("collect os info: %w", err)
	}

	fingerprint := buildFingerprint(osInfo.Hostname)

	body := map[string]interface{}{
		"hostname":         osInfo.Hostname,
		"os_type":          osInfo.OSType,
		"os_version":       osInfo.OSVersion,
		"arch":             osInfo.Arch,
		"fingerprint":      fingerprint,
		"enrollment_token": cfg.Server.EnrollmentToken,
	}

	data, _ := json.Marshal(body)
	apiURL := strings.TrimRight(cfg.Server.URL, "/")
	// Replace ws(s) with http(s)
	apiURL = strings.Replace(apiURL, "wss://", "https://", 1)
	apiURL = strings.Replace(apiURL, "ws://", "http://", 1)

	resp, err := http.Post(apiURL+"/api/v1/devices/register", "application/json",
		strings.NewReader(string(data)))
	if err != nil {
		return fmt.Errorf("register request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server returned %d", resp.StatusCode)
	}

	var result struct {
		DeviceID string `json:"device_id"`
		APIKey   string `json:"api_key"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("parse response: %w", err)
	}

	cfg.Agent.DeviceID = result.DeviceID
	cfg.Agent.APIKey = result.APIKey

	if err := config.Save(cfgPath, cfg); err != nil {
		return fmt.Errorf("save config: %w", err)
	}

	slog.Info("device registered", "device_id", result.DeviceID)
	return nil
}

func buildFingerprint(hostname string) string {
	h := sha256.New()
	h.Write([]byte(hostname))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func telemetryLoop(ctx context.Context, client *transport.Client, cfg *config.Config) {
	ticker := time.NewTicker(time.Duration(cfg.Collect.TelemetryIntervalSecs) * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			data, err := collector.CollectTelemetry()
			if err != nil {
				slog.Warn("telemetry collection failed", "error", err)
				continue
			}
			client.SendTelemetry(data)
		}
	}
}

func softwareLoop(ctx context.Context, client *transport.Client, cfg *config.Config) {
	ticker := time.NewTicker(time.Duration(cfg.Collect.SoftwareScanIntervalM) * time.Minute)
	defer ticker.Stop()

	// Send once at startup
	sendSoftware(client)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sendSoftware(client)
		}
	}
}

func sendSoftware(client *transport.Client) {
	pkgs, err := collector.CollectSoftware()
	if err != nil {
		slog.Warn("software collection failed", "error", err)
		return
	}
	client.SendSoftwareInventory(pkgs)
	slog.Info("software inventory sent", "packages", len(pkgs))
}

func ntpLoop(ctx context.Context, client *transport.Client, cfg *config.Config) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			status := collector.CollectNTPStatus()
			client.SendNTPStatus(status)
		}
	}
}

func eventLoop(ctx context.Context, client *transport.Client, cfg *config.Config) {
	ticker := time.NewTicker(time.Duration(cfg.Collect.EventPollIntervalSecs) * time.Second)
	defer ticker.Stop()

	lastChecked := time.Now().Add(-5 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			events, err := collector.CollectEvents(lastChecked)
			if err != nil {
				slog.Warn("event collection failed", "error", err)
				continue
			}
			lastChecked = time.Now()
			for _, ev := range events {
				client.SendEvent(ev)
			}
		}
	}
}

func networkLoop(ctx context.Context, client *transport.Client) {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	sendNetwork(client)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sendNetwork(client)
		}
	}
}

func sendNetwork(client *transport.Client) {
	ifaces, err := collector.CollectNetworkInfo()
	if err != nil {
		slog.Warn("network collection failed", "error", err)
		return
	}

	client.Send(transport.Message{
		Type: transport.MsgTypeNetworkInfo,
		Data: transport.NetworkInfoData{Interfaces: ifaces},
	})
}

func updateLoop(ctx context.Context, cfg *config.Config) {
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()

	check := func() bool {
		updateCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
		defer cancel()

		updated, err := updater.CheckAndUpdate(
			updateCtx,
			cfg.Server.URL,
			AgentVersion,
			cfg.Agent.DeviceID,
			cfg.Agent.APIKey,
		)
		if err != nil {
			slog.Warn("agent update check failed", "error", err)
			return false
		}
		return updated
	}

	if check() {
		restartAgent()
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if check() {
				restartAgent()
				return
			}
		}
	}
}

func restartAgent() {
	slog.Info("Agent updated, restarting...")

	exePath, err := os.Executable()
	if err != nil {
		slog.Error("failed to determine executable path", "error", err)
		return
	}

	if runtime.GOOS == "windows" {
		scriptPath := filepath.Join(filepath.Dir(exePath), "dtsys-update.bat")
		if err := exec.Command(scriptPath).Start(); err != nil {
			slog.Error("failed to launch update script", "error", err)
			return
		}
		os.Exit(0)
	}

	cmd := exec.Command(exePath, os.Args[1:]...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Start(); err != nil {
		slog.Error("failed to restart agent", "error", err)
		return
	}
	os.Exit(0)
}
