//go:build windows

package collector

import (
	"encoding/json"
	"os/exec"
	"strings"

	"github.com/dtsys/agent/internal/transport"
)

// CollectSoftware returns installed software on Windows via PowerShell.
func CollectSoftware() ([]transport.SoftwarePackage, error) {
	script := `Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* |
		Select-Object DisplayName, DisplayVersion |
		Where-Object { $_.DisplayName -ne $null } |
		ConvertTo-Json -Compress`

	out, err := exec.Command("powershell", "-NoProfile", "-Command", script).Output()
	if err != nil {
		return nil, err
	}

	var raw []struct {
		DisplayName    string `json:"DisplayName"`
		DisplayVersion string `json:"DisplayVersion"`
	}
	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}

	var packages []transport.SoftwarePackage
	for _, r := range raw {
		name := strings.TrimSpace(r.DisplayName)
		if name == "" {
			continue
		}
		packages = append(packages, transport.SoftwarePackage{
			Name:    name,
			Version: strings.TrimSpace(r.DisplayVersion),
		})
	}
	return packages, nil
}
