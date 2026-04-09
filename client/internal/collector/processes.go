package collector

import (
	"sort"

	"github.com/shirou/gopsutil/v3/process"

	"github.com/dtsys/agent/internal/transport"
)

func CollectTopProcesses(n int) ([]transport.ProcessInfo, error) {
	if n <= 0 {
		n = 15
	}

	processes, err := process.Processes()
	if err != nil {
		return nil, err
	}

	results := make([]transport.ProcessInfo, 0, len(processes))
	for _, proc := range processes {
		name, err := proc.Name()
		if err != nil || name == "" {
			continue
		}

		cpuPercent, err := proc.CPUPercent()
		if err != nil {
			cpuPercent = 0
		}

		memoryPercent, err := proc.MemoryPercent()
		if err != nil {
			memoryPercent = 0
		}

		status, err := proc.Status()
		if err != nil || len(status) == 0 {
			status = []string{"unknown"}
		}

		results = append(results, transport.ProcessInfo{
			PID:        int(proc.Pid),
			Name:       name,
			CPUPercent: cpuPercent,
			MemPercent: float64(memoryPercent),
			Status:     status[0],
		})
	}

	sort.Slice(results, func(i, j int) bool {
		if results[i].CPUPercent == results[j].CPUPercent {
			return results[i].MemPercent > results[j].MemPercent
		}
		return results[i].CPUPercent > results[j].CPUPercent
	})

	if len(results) > n {
		results = results[:n]
	}

	return results, nil
}
