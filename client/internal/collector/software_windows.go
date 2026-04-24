//go:build windows

package collector

import (
	"bufio"
	"bytes"
	"encoding/json"
	"os/exec"
	"strings"

	"github.com/dtsys/agent/internal/transport"
)

// CollectSoftware returns installed software on Windows via registry query,
// with update availability from winget if available.
func CollectSoftware() ([]transport.SoftwarePackage, error) {
	pkgs, err := collectRegistry()
	if err != nil {
		return nil, err
	}
	applyWingetUpdates(pkgs)
	return pkgs, nil
}

func collectRegistry() ([]transport.SoftwarePackage, error) {
	// Query both 64-bit and 32-bit uninstall keys
	script := `
$paths = @(
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$seen = @{}
$result = @()
foreach ($path in $paths) {
  if (Test-Path $path) {
    Get-ItemProperty $path -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -ne $null -and $_.DisplayName -ne '' } |
      ForEach-Object {
        $key = $_.DisplayName.Trim()
        if (-not $seen.ContainsKey($key)) {
          $seen[$key] = $true
          $result += [PSCustomObject]@{
            Name    = $key
            Version = if ($_.DisplayVersion) { $_.DisplayVersion.Trim() } else { '' }
          }
        }
      }
  }
}
$result | ConvertTo-Json -Compress`

	out, err := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script).Output()
	if err != nil {
		return nil, err
	}

	// PowerShell returns a single object (not array) when there's only one item
	out = bytes.TrimSpace(out)
	if len(out) > 0 && out[0] == '{' {
		out = append([]byte{'['}, append(out, ']')...)
	}

	var raw []struct {
		Name    string `json:"Name"`
		Version string `json:"Version"`
	}
	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}

	var packages []transport.SoftwarePackage
	for _, r := range raw {
		name := strings.TrimSpace(r.Name)
		if name == "" {
			continue
		}
		packages = append(packages, transport.SoftwarePackage{
			Name:    name,
			Version: strings.TrimSpace(r.Version),
		})
	}
	return packages, nil
}

// applyWingetUpdates calls "winget upgrade --include-unknown" and marks packages
// that have updates available. Silently skips if winget is not installed.
func applyWingetUpdates(pkgs []transport.SoftwarePackage) {
	// Build lowercase name index for fuzzy matching (winget names may differ slightly)
	idx := make(map[string]int, len(pkgs))
	for i, p := range pkgs {
		idx[strings.ToLower(p.Name)] = i
	}

	out, err := exec.Command("winget", "upgrade", "--include-unknown", "--disable-interactivity").Output()
	if err != nil {
		return
	}

	// winget output is a text table with headers and a dashed separator.
	// Format: Name   Id   Version   Available   Source
	scanner := bufio.NewScanner(bytes.NewReader(out))
	pastHeader := false
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "-") {
			pastHeader = true
			continue
		}
		if !pastHeader {
			continue
		}
		// The last line is typically "N upgrades available."
		if strings.Contains(line, "upgrades available") || strings.TrimSpace(line) == "" {
			continue
		}
		// Columns are fixed-width — split on 2+ spaces to get fields
		fields := splitWingetLine(line)
		if len(fields) < 4 {
			continue
		}
		name := strings.ToLower(strings.TrimSpace(fields[0]))
		latestVersion := strings.TrimSpace(fields[3])
		if latestVersion == "" || latestVersion == "Unknown" {
			continue
		}
		if i, ok := idx[name]; ok {
			pkgs[i].UpdateAvailable = true
			pkgs[i].LatestVersion = latestVersion
		}
	}
}

// splitWingetLine splits a winget table row on runs of 2+ spaces.
func splitWingetLine(line string) []string {
	var fields []string
	start := 0
	inGap := false
	for i := 0; i < len(line); i++ {
		if line[i] == ' ' {
			if !inGap && i+1 < len(line) && line[i+1] == ' ' {
				fields = append(fields, strings.TrimSpace(line[start:i]))
				inGap = true
			}
		} else {
			if inGap {
				start = i
				inGap = false
			}
		}
	}
	if start < len(line) {
		fields = append(fields, strings.TrimSpace(line[start:]))
	}
	return fields
}
