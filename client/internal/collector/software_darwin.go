//go:build darwin

package collector

import (
	"bufio"
	"bytes"
	"encoding/json"
	"os/exec"
	"strings"

	"github.com/dtsys/agent/internal/transport"
)

// CollectSoftware returns installed packages on macOS via Homebrew + system_profiler.
func CollectSoftware() ([]transport.SoftwarePackage, error) {
	var packages []transport.SoftwarePackage

	// Homebrew packages
	brewPkgs, _ := collectHomebrew()
	packages = append(packages, brewPkgs...)

	// System installed apps via system_profiler
	appPkgs, _ := collectSystemProfiler()
	packages = append(packages, appPkgs...)

	return packages, nil
}

func collectHomebrew() ([]transport.SoftwarePackage, error) {
	out, err := exec.Command("brew", "list", "--versions").Output()
	if err != nil {
		return nil, err
	}

	var packages []transport.SoftwarePackage
	scanner := bufio.NewScanner(bytes.NewReader(out))
	for scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		if len(parts) < 2 {
			continue
		}
		packages = append(packages, transport.SoftwarePackage{
			Name:    parts[0],
			Version: parts[len(parts)-1],
		})
	}
	return packages, nil
}

func collectSystemProfiler() ([]transport.SoftwarePackage, error) {
	out, err := exec.Command("system_profiler", "SPApplicationsDataType", "-json").Output()
	if err != nil {
		return nil, err
	}

	// Parse JSON from system_profiler - simplified extraction
	var result map[string]interface{}
	if err := json.Unmarshal(out, &result); err != nil {
		return nil, err
	}

	var packages []transport.SoftwarePackage
	if apps, ok := result["SPApplicationsDataType"].([]interface{}); ok {
		for _, a := range apps {
			if app, ok := a.(map[string]interface{}); ok {
				name, _ := app["_name"].(string)
				version, _ := app["version"].(string)
				if name != "" {
					packages = append(packages, transport.SoftwarePackage{
						Name:    name,
						Version: version,
					})
				}
			}
		}
	}
	return packages, nil
}
