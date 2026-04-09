package collector

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// CaptureScreenshot returns a JPEG screenshot of the primary display.
func CaptureScreenshot(ctx context.Context) ([]byte, error) {
	switch runtime.GOOS {
	case "windows":
		return captureWindowsScreenshot(ctx)
	case "darwin":
		return captureDarwinScreenshot(ctx)
	default:
		return captureLinuxScreenshot(ctx)
	}
}

func captureWindowsScreenshot(ctx context.Context) ([]byte, error) {
	script := strings.Join([]string{
		"Add-Type -AssemblyName System.Windows.Forms;",
		"Add-Type -AssemblyName System.Drawing;",
		"$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;",
		"$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height);",
		"$graphics = [System.Drawing.Graphics]::FromImage($bmp);",
		"$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);",
		"$stream = New-Object System.IO.MemoryStream;",
		"$bmp.Save($stream, [System.Drawing.Imaging.ImageFormat]::Jpeg);",
		"$graphics.Dispose();",
		"$bmp.Dispose();",
		"[Convert]::ToBase64String($stream.ToArray())",
	}, " ")

	out, err := exec.CommandContext(ctx, "powershell", "-NoProfile", "-Command", script).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("powershell screenshot failed: %w: %s", err, strings.TrimSpace(string(out)))
	}

	data, decodeErr := base64.StdEncoding.DecodeString(strings.TrimSpace(string(out)))
	if decodeErr != nil {
		return nil, fmt.Errorf("decode screenshot output: %w", decodeErr)
	}
	return data, nil
}

func captureDarwinScreenshot(ctx context.Context) ([]byte, error) {
	tempFile, err := os.CreateTemp("", "dtsys-screenshot-*.jpg")
	if err != nil {
		return nil, err
	}
	path := tempFile.Name()
	_ = tempFile.Close()
	defer os.Remove(path)

	out, err := exec.CommandContext(ctx, "screencapture", "-x", "-t", "jpg", path).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("screencapture failed: %w: %s", err, strings.TrimSpace(string(out)))
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read screenshot: %w", err)
	}
	return data, nil
}

func captureLinuxScreenshot(ctx context.Context) ([]byte, error) {
	tempFile, err := os.CreateTemp("", "dtsys-screenshot-*.jpg")
	if err != nil {
		return nil, err
	}
	path := tempFile.Name()
	_ = tempFile.Close()
	defer os.Remove(path)

	commands := [][]string{
		{"scrot", path},
		{"import", "-window", "root", path},
	}

	var outputs []string
	for _, args := range commands {
		if _, lookErr := exec.LookPath(args[0]); lookErr != nil {
			outputs = append(outputs, fmt.Sprintf("%s: not available", args[0]))
			continue
		}
		out, runErr := exec.CommandContext(ctx, args[0], args[1:]...).CombinedOutput()
		if runErr == nil {
			data, readErr := os.ReadFile(path)
			if readErr != nil {
				return nil, fmt.Errorf("read screenshot: %w", readErr)
			}
			return data, nil
		}
		outputs = append(outputs, fmt.Sprintf("%s: %s", args[0], strings.TrimSpace(string(out))))
	}

	return nil, fmt.Errorf("linux screenshot failed: %s", strings.Join(outputs, "; "))
}
