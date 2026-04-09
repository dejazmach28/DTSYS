package collector_test

import (
	"testing"

	"github.com/dtsys/agent/internal/collector"
)

func TestCollectTelemetry(t *testing.T) {
	data, err := collector.CollectTelemetry()
	if err != nil {
		t.Fatalf("CollectTelemetry returned error: %v", err)
	}

	if data.CPUPercent < 0 || data.CPUPercent > 100 {
		t.Fatalf("unexpected CPU percent: %v", data.CPUPercent)
	}
	if data.RAMPercent <= 0 || data.RAMPercent > 100 {
		t.Fatalf("unexpected RAM percent: %v", data.RAMPercent)
	}
	if data.DiskPercent <= 0 || data.DiskPercent > 100 {
		t.Fatalf("unexpected disk percent: %v", data.DiskPercent)
	}
}
