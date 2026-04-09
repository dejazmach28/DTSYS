package collector

import (
	"net"

	"github.com/dtsys/agent/internal/transport"
)

// CollectNetworkInfo returns all active non-loopback interfaces and their addresses.
func CollectNetworkInfo() ([]transport.NetworkInterface, error) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	results := make([]transport.NetworkInterface, 0, len(interfaces))
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			return nil, err
		}

		info := transport.NetworkInterface{
			Name:       iface.Name,
			MACAddress: iface.HardwareAddr.String(),
			IsUp:       iface.Flags&net.FlagUp != 0,
			MTU:        iface.MTU,
		}

		for _, addr := range addrs {
			ip, network, err := net.ParseCIDR(addr.String())
			if err != nil {
				continue
			}
			if ip.To4() != nil {
				info.IPv4 = append(info.IPv4, network.String())
				continue
			}
			info.IPv6 = append(info.IPv6, network.String())
		}

		results = append(results, info)
	}

	return results, nil
}
