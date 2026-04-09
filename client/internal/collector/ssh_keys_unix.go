//go:build !windows

// Package collector gathers device state from the local system.
package collector

import (
	"bufio"
	"crypto/sha256"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"github.com/dtsys/agent/internal/transport"
)

// CollectSSHKeys inventories authorized SSH keys from common user and root locations.
func CollectSSHKeys() ([]transport.SSHKeyInfo, error) {
	paths := []string{"/root/.ssh/authorized_keys"}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		paths = append(paths, filepath.Join(home, ".ssh", "authorized_keys"))
	}

	seen := map[string]struct{}{}
	keys := make([]transport.SSHKeyInfo, 0)
	for _, path := range paths {
		file, err := os.Open(path)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.Fields(line)
			if len(parts) < 2 {
				continue
			}
			comment := ""
			if len(parts) > 2 {
				comment = strings.Join(parts[2:], " ")
			}
			fingerprint := sshFingerprint(parts[1])
			if _, ok := seen[fingerprint]; ok {
				continue
			}
			seen[fingerprint] = struct{}{}
			keys = append(keys, transport.SSHKeyInfo{
				Type:        parts[0],
				PublicKey:   parts[1],
				Comment:     comment,
				Fingerprint: fingerprint,
			})
		}
		_ = file.Close()
	}
	return keys, nil
}

func sshFingerprint(publicKey string) string {
	sum := sha256.Sum256([]byte(publicKey))
	return "SHA256:" + base64.StdEncoding.EncodeToString(sum[:])
}
