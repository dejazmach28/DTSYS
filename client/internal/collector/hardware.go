package collector

import (
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	gnet "github.com/shirou/gopsutil/v3/net"

	"github.com/dtsys/agent/internal/transport"
)

var (
	prevDiskReadBytes  uint64
	prevDiskWriteBytes uint64
	prevNetSentBytes   uint64
	prevNetRecvBytes   uint64
	prevSampleTime     time.Time
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

	applyThroughputMetrics(&data)

	return data, nil
}

func applyThroughputMetrics(data *transport.TelemetryData) {
	now := time.Now()
	diskReadBytes, diskWriteBytes := collectDiskIOBytes()
	netSentBytes, netRecvBytes := collectNetworkIOBytes()

	if !prevSampleTime.IsZero() {
		elapsed := now.Sub(prevSampleTime).Seconds()
		if elapsed > 0 {
			data.DiskReadMBps = bytesPerSecondToMBps(deltaUint64(diskReadBytes, prevDiskReadBytes), elapsed)
			data.DiskWriteMBps = bytesPerSecondToMBps(deltaUint64(diskWriteBytes, prevDiskWriteBytes), elapsed)
			data.NetSentMBps = bytesPerSecondToMBps(deltaUint64(netSentBytes, prevNetSentBytes), elapsed)
			data.NetRecvMBps = bytesPerSecondToMBps(deltaUint64(netRecvBytes, prevNetRecvBytes), elapsed)
		}
	}

	prevDiskReadBytes = diskReadBytes
	prevDiskWriteBytes = diskWriteBytes
	prevNetSentBytes = netSentBytes
	prevNetRecvBytes = netRecvBytes
	prevSampleTime = now
}

func collectDiskIOBytes() (uint64, uint64) {
	ioCounters, err := disk.IOCounters()
	if err != nil {
		return 0, 0
	}

	var readBytes uint64
	var writeBytes uint64
	for _, counter := range ioCounters {
		readBytes += counter.ReadBytes
		writeBytes += counter.WriteBytes
	}
	return readBytes, writeBytes
}

func collectNetworkIOBytes() (uint64, uint64) {
	ioCounters, err := gnet.IOCounters(false)
	if err != nil || len(ioCounters) == 0 {
		return 0, 0
	}

	return ioCounters[0].BytesSent, ioCounters[0].BytesRecv
}

func deltaUint64(current, previous uint64) uint64 {
	if current < previous {
		return 0
	}
	return current - previous
}

func bytesPerSecondToMBps(bytes uint64, seconds float64) float64 {
	return float64(bytes) / seconds / 1024 / 1024
}
