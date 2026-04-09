//go:build windows

// Package collector gathers device state from the local system.
package collector

import "github.com/dtsys/agent/internal/transport"

// CollectSSHKeys returns no SSH keys on Windows.
func CollectSSHKeys() ([]transport.SSHKeyInfo, error) {
	return []transport.SSHKeyInfo{}, nil
}
