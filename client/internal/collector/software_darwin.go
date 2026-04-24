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

// CollectSoftware returns installed packages on macOS via Homebrew + system_profiler,
// with update availability from "brew outdated".
func CollectSoftware() ([]transport.SoftwarePackage, error) {
	var packages []transport.SoftwarePackage

	brewPkgs, _ := collectHomebrew()
	packages = append(packages, brewPkgs...)

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

	// Cross-reference with brew outdated
	applyBrewUpdates(packages)
	return packages, nil
}

// applyBrewUpdates runs "brew outdated --json=v2" and annotates packages
// that have a newer version available in the Homebrew registry.
func applyBrewUpdates(pkgs []transport.SoftwarePackage) {
	idx := make(map[string]int, len(pkgs))
	for i, p := range pkgs {
		idx[p.Name] = i
	}

	out, err := exec.Command("brew", "outdated", "--json=v2").Output()
	if err != nil {
		return
	}

	var result struct {
		Formulae []struct {
			Name           string   `json:"name"`
			CurrentVersion string   `json:"current_version"`
			InstalledVersions []string `json:"installed_versions"`
		} `json:"formulae"`
		Casks []struct {
			Name           string `json:"token"`
			CurrentVersion string `json:"current_version"`
		} `json:"casks"`
	}
	if err := json.Unmarshal(out, &result); err != nil {
		return
	}

	for _, f := range result.Formulae {
		if i, ok := idx[f.Name]; ok {
			pkgs[i].UpdateAvailable = true
			pkgs[i].LatestVersion = f.CurrentVersion
		}
	}
	for _, c := range result.Casks {
		if i, ok := idx[c.Name]; ok {
			pkgs[i].UpdateAvailable = true
			pkgs[i].LatestVersion = c.CurrentVersion
		}
	}
}

func collectSystemProfiler() ([]transport.SoftwarePackage, error) {
	out, err := exec.Command("system_profiler", "SPApplicationsDataType", "-json").Output()
	if err != nil {
		return nil, err
	}

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
