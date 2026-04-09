//go:build linux

package collector

import (
	"bufio"
	"bytes"
	"os/exec"
	"strings"

	"github.com/dtsys/agent/internal/transport"
)

// CollectSoftware returns installed packages on Linux using dpkg or rpm.
func CollectSoftware() ([]transport.SoftwarePackage, error) {
	// Try dpkg first (Debian/Ubuntu)
	pkgs, err := collectDpkg()
	if err == nil {
		return pkgs, nil
	}
	// Fall back to rpm (RHEL/Fedora/CentOS)
	return collectRpm()
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
