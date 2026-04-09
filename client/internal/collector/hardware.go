package collector

import (
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"

	"github.com/dtsys/agent/internal/transport"
)

// CollectTelemetry gathers current hardware metrics.
func CollectTelemetry() (transport.TelemetryData, error) {
	var data transport.TelemetryData

	// CPU
	percents, err := cpu.Percent(500*time.Millisecond, false)
	if err == nil && len(percents) > 0 {
		data.CPUPercent = percents[0]
	}

	// RAM
	vmStat, err := mem.VirtualMemory()
	if err == nil {
		data.RAMPercent = vmStat.UsedPercent
		data.RAMTotalMB = float64(vmStat.Total) / 1024 / 1024
		data.RAMUsedMB = float64(vmStat.Used) / 1024 / 1024
	}

	// Disk (root / C:)
	partitions, err := disk.Partitions(false)
	if err == nil && len(partitions) > 0 {
		// Use the first partition (root or C:)
		mountpoint := "/"
		for _, p := range partitions {
			if p.Mountpoint == "/" || p.Mountpoint == "C:\\" {
				mountpoint = p.Mountpoint
				break
			}
		}
		usage, err := disk.Usage(mountpoint)
		if err == nil {
			data.DiskPercent = usage.UsedPercent
			data.DiskTotalGB = float64(usage.Total) / 1024 / 1024 / 1024
			data.DiskUsedGB = float64(usage.Used) / 1024 / 1024 / 1024
		}
	}

	// Uptime
	info, err := host.Info()
	if err == nil {
		data.UptimeSecs = int64(info.Uptime)
	}

	// CPU temp (best-effort, not available on all platforms)
	temps, err := host.SensorsTemperatures()
	if err == nil {
		for _, t := range temps {
			if t.Temperature > 0 && t.Temperature < 150 {
				// Take first reasonable reading
				data.CPUTemp = t.Temperature
				break
			}
		}
	}

	return data, nil
}
