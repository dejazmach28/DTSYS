package executor

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/jpeg"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/dtsys/agent/internal/collector"
	"github.com/dtsys/agent/internal/transport"
)

const maxOutputBytes = 1 * 1024 * 1024 // 1MB output cap

// Execute runs a command and returns the result.
func Execute(ctx context.Context, cmd transport.IncomingCommand, send func(transport.Message)) transport.CommandResultData {
	timeout := 60 * time.Second
	if t, ok := cmd.Payload["timeout_secs"].(float64); ok && t > 0 && t <= 300 {
		timeout = time.Duration(t) * time.Second
	}

	execCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var out []byte
	var exitCode int
	var err error

	switch cmd.CommandType {
	case "shell":
		out, exitCode, err = runShell(execCtx, cmd.Payload)
	case "reboot":
		out, exitCode, err = runReboot(execCtx)
	case "update_check":
		out, exitCode, err = runUpdateCheck(execCtx)
	case "sync_time":
		out, exitCode, err = runSyncTime(execCtx)
	case "screenshot":
		out, exitCode, err = runScreenshot(execCtx, cmd, send)
	default:
		return transport.CommandResultData{
			CommandID: cmd.CommandID,
			ExitCode:  1,
			Output:    fmt.Sprintf("unknown command type: %s", cmd.CommandType),
		}
	}

	if err != nil && exitCode == 0 {
		exitCode = 1
	}

	output := string(out)
	if len(output) > maxOutputBytes {
		output = output[:maxOutputBytes] + "\n[output truncated]"
	}

	return transport.CommandResultData{
		CommandID: cmd.CommandID,
		ExitCode:  exitCode,
		Output:    output,
	}
}

func runShell(ctx context.Context, payload map[string]interface{}) ([]byte, int, error) {
	command, _ := payload["command"].(string)
	if command == "" {
		return nil, 1, fmt.Errorf("command payload missing 'command' field")
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.CommandContext(ctx, "cmd", "/C", command)
	default:
		cmd = exec.CommandContext(ctx, "/bin/sh", "-c", command)
	}

	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}

	return buf.Bytes(), exitCode, err
}

func runReboot(ctx context.Context) ([]byte, int, error) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.CommandContext(ctx, "shutdown", "/r", "/t", "30", "/c", "DTSYS scheduled reboot")
	case "darwin":
		cmd = exec.CommandContext(ctx, "shutdown", "-r", "+1")
	default:
		cmd = exec.CommandContext(ctx, "shutdown", "-r", "+1", "DTSYS scheduled reboot")
	}

	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}
	return buf.Bytes(), exitCode, err
}

func runUpdateCheck(ctx context.Context) ([]byte, int, error) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.CommandContext(ctx, "powershell", "-Command",
			`(New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher().Search("IsInstalled=0").Updates | Select Title | Format-List`)
	case "darwin":
		cmd = exec.CommandContext(ctx, "softwareupdate", "-l")
	default:
		// Try apt or dnf
		if _, err := exec.LookPath("apt-get"); err == nil {
			cmd = exec.CommandContext(ctx, "apt-get", "-s", "upgrade")
		} else {
			cmd = exec.CommandContext(ctx, "dnf", "check-update")
		}
	}

	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			// dnf check-update exits 100 when updates are available
			if exitErr.ExitCode() == 100 {
				exitCode = 0
			} else {
				exitCode = exitErr.ExitCode()
			}
		} else {
			exitCode = 1
		}
	}

	output := strings.TrimSpace(buf.String())
	if output == "" {
		output = "No updates available"
	}
	return []byte(output), exitCode, nil
}

func runSyncTime(ctx context.Context) ([]byte, int, error) {
	switch runtime.GOOS {
	case "windows":
		return runSingleCommand(ctx, exec.CommandContext(ctx, "w32tm", "/resync", "/force"))
	case "darwin":
		return runSingleCommand(ctx, exec.CommandContext(ctx, "sntp", "-sS", "time.apple.com"))
	default:
		commands := []*exec.Cmd{
			exec.CommandContext(ctx, "chronyc", "makestep"),
			exec.CommandContext(ctx, "timedatectl", "set-ntp", "true"),
			exec.CommandContext(ctx, "ntpdate", "-u", "pool.ntp.org"),
		}
		var outputs []string
		for _, cmd := range commands {
			if _, err := exec.LookPath(cmd.Path); err != nil {
				outputs = append(outputs, fmt.Sprintf("%s: not available", cmd.Path))
				continue
			}
			out, exitCode, err := runSingleCommand(ctx, cmd)
			outputs = append(outputs, strings.TrimSpace(string(out)))
			if err == nil && exitCode == 0 {
				return []byte(strings.Join(compactStrings(outputs), "\n")), 0, nil
			}
		}
		output := strings.Join(compactStrings(outputs), "\n")
		if output == "" {
			output = "no supported time sync command available"
		}
		return []byte(output), 1, fmt.Errorf("time sync failed")
	}
}

func runSingleCommand(ctx context.Context, cmd *exec.Cmd) ([]byte, int, error) {
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}

	if ctx.Err() != nil && exitCode == 0 {
		exitCode = 1
	}
	return buf.Bytes(), exitCode, err
}

func compactStrings(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			result = append(result, value)
		}
	}
	return result
}

func runScreenshot(ctx context.Context, cmd transport.IncomingCommand, send func(transport.Message)) ([]byte, int, error) {
	imageBytes, err := collector.CaptureScreenshot(ctx)
	if err != nil {
		if send != nil {
			send(transport.Message{
				Type: transport.MsgTypeScreenshotResult,
				Data: transport.ScreenshotResultData{
					CommandID: cmd.CommandID,
					Error:     err.Error(),
				},
			})
		}
		return []byte(err.Error()), 1, err
	}

	width, height := 0, 0
	if cfg, _, cfgErr := image.DecodeConfig(bytes.NewReader(imageBytes)); cfgErr == nil {
		width = cfg.Width
		height = cfg.Height
	}

	if send != nil {
		send(transport.Message{
			Type: transport.MsgTypeScreenshotResult,
			Data: transport.ScreenshotResultData{
				CommandID: cmd.CommandID,
				ImageB64:  base64.StdEncoding.EncodeToString(imageBytes),
				Width:     width,
				Height:    height,
			},
		})
	}

	return []byte("screenshot captured"), 0, nil
}
