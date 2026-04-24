//go:build linux

package collector

import (
	"bufio"
	"bytes"
	"os/exec"
	"strings"

	"github.com/dtsys/agent/internal/transport"
)

// CollectSoftware returns installed packages on Linux using dpkg or rpm,
// cross-referenced with available updates from apt or dnf.
func CollectSoftware() ([]transport.SoftwarePackage, error) {
	pkgs, err := collectDpkg()
	if err == nil {
		applyAptUpdates(pkgs)
		return pkgs, nil
	}
	pkgs, err = collectRpm()
	if err == nil {
		applyDnfUpdates(pkgs)
		return pkgs, nil
	}
	return nil, err
}

func collectDpkg() ([]transport.SoftwarePackage, error) {
	out, err := exec.Command("dpkg-query", "-W", "-f=${Package}\t${Version}\n").Output()
	if err != nil {
		return nil, err
	}

	var packages []transport.SoftwarePackage
	scanner := bufio.NewScanner(bytes.NewReader(out))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) < 2 {
			continue
		}
		packages = append(packages, transport.SoftwarePackage{
			Name:    strings.TrimSpace(parts[0]),
			Version: strings.TrimSpace(parts[1]),
		})
	}
	return packages, nil
}

// applyAptUpdates runs "apt list --upgradable" and marks packages that have
// a newer version available. Errors are silently ignored — the package list
// is still useful without update metadata.
func applyAptUpdates(pkgs []transport.SoftwarePackage) {
	// Build a name→index map for O(1) lookup
	idx := make(map[string]int, len(pkgs))
	for i, p := range pkgs {
		idx[p.Name] = i
	}

	// apt list --upgradable output format:
	//   <name>/<suite> <newversion> <arch> [upgradable from: <oldversion>]
	out, err := exec.Command("apt", "list", "--upgradable").Output()
	if err != nil {
		return
	}

	scanner := bufio.NewScanner(bytes.NewReader(out))
	for scanner.Scan() {
		line := scanner.Text()
		// Skip the "Listing..." header line
		if !strings.Contains(line, "/") {
			continue
		}
		// name/suite version arch [upgradable from: old]
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		name := strings.SplitN(fields[0], "/", 2)[0]
		latestVersion := fields[1]
		if i, ok := idx[name]; ok {
			pkgs[i].UpdateAvailable = true
			pkgs[i].LatestVersion = latestVersion
		}
	}
}

func collectRpm() ([]transport.SoftwarePackage, error) {
	out, err := exec.Command("rpm", "-qa", "--queryformat", "%{NAME}\t%{VERSION}-%{RELEASE}\n").Output()
	if err != nil {
		return nil, err
	}

	var packages []transport.SoftwarePackage
	scanner := bufio.NewScanner(bytes.NewReader(out))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) < 2 {
			continue
		}
		packages = append(packages, transport.SoftwarePackage{
			Name:    strings.TrimSpace(parts[0]),
			Version: strings.TrimSpace(parts[1]),
		})
	}
	return packages, nil
}

// applyDnfUpdates runs "dnf check-update -q" and marks packages with updates.
// dnf exits with code 100 when updates are available (not an error).
func applyDnfUpdates(pkgs []transport.SoftwarePackage) {
	idx := make(map[string]int, len(pkgs))
	for i, p := range pkgs {
		idx[p.Name] = i
	}

	// dnf check-update exits 100 when updates exist, 0 when none, non-zero on error
	cmd := exec.Command("dnf", "check-update", "-q", "--no-color")
	out, _ := cmd.Output() // ignore exit code — 100 is normal
	if len(out) == 0 {
		return
	}

	// Output format: <name>.<arch>    <version>    <repo>
	scanner := bufio.NewScanner(bytes.NewReader(out))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "Last metadata") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		// Strip arch suffix: "bash.x86_64" → "bash"
		nameParts := strings.SplitN(fields[0], ".", 2)
		name := nameParts[0]
		latestVersion := fields[1]
		if i, ok := idx[name]; ok {
			pkgs[i].UpdateAvailable = true
			pkgs[i].LatestVersion = latestVersion
		}
	}
}
