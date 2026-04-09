package transport_test

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/dtsys/agent/internal/transport"
)

func TestMessageSerialization(t *testing.T) {
	tests := []struct {
		name  string
		value any
		dest  any
	}{
		{
			name: "telemetry",
			value: transport.TelemetryData{
				CPUPercent:  12.5,
				RAMPercent:  34.5,
				DiskPercent: 56.5,
				UptimeSecs:  1234,
			},
			dest: &transport.TelemetryData{},
		},
		{
			name: "software_package",
			value: transport.SoftwarePackage{
				Name:            "vim",
				Version:         "9.0",
				UpdateAvailable: true,
				LatestVersion:   "9.1",
			},
			dest: &transport.SoftwarePackage{},
		},
		{
			name: "network_interface",
			value: transport.NetworkInterface{
				Name:       "eth0",
				MACAddress: "00:11:22:33:44:55",
				IPv4:       []string{"192.168.1.10/24"},
				IPv6:       []string{"fe80::1/64"},
				IsUp:       true,
				MTU:        1500,
			},
			dest: &transport.NetworkInterface{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			raw, err := json.Marshal(tc.value)
			if err != nil {
				t.Fatalf("marshal failed: %v", err)
			}
			if err := json.Unmarshal(raw, tc.dest); err != nil {
				t.Fatalf("unmarshal failed: %v", err)
			}

			if !reflect.DeepEqual(tc.value, reflect.ValueOf(tc.dest).Elem().Interface()) {
				t.Fatalf("round-trip mismatch: got %#v want %#v", reflect.ValueOf(tc.dest).Elem().Interface(), tc.value)
			}
		})
	}
}
