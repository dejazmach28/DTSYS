package collector

import (
	"runtime"
	"strings"

	"github.com/shirou/gopsutil/v3/host"
)

type OSInfo struct {
	Hostname  string
	OSType    string // windows|linux|macos
	OSVersion string
	Arch      string
}

func CollectOSInfo() (OSInfo, error) {
	info, err := host.Info()
	if err != nil {
		return OSInfo{}, err
	}

	osType := normalizeOS(runtime.GOOS)
	version := info.PlatformVersion
	if info.Platform != "" {
		version = info.Platform + " " + info.PlatformVersion
	}

	return OSInfo{
		Hostname:  info.Hostname,
		OSType:    osType,
		OSVersion: strings.TrimSpace(version),
		Arch:      runtime.GOARCH,
	}, nil
}

func normalizeOS(goos string) string {
	switch goos {
	case "windows":
		return "windows"
	case "darwin":
		return "macos"
	default:
		return "linux"
	}
}
