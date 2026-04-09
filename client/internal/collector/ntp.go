package collector

import (
	"net"
	"time"

	"github.com/dtsys/agent/internal/transport"
)

const ntpServer = "pool.ntp.org:123"

// CollectNTPStatus checks time sync by querying an NTP server directly.
func CollectNTPStatus() transport.NTPStatusData {
	offset, err := queryNTPOffset(ntpServer)
	if err != nil {
		return transport.NTPStatusData{
			IsSynced:  false,
			OffsetMS:  0,
			NTPServer: ntpServer,
		}
	}

	absOffset := offset
	if absOffset < 0 {
		absOffset = -absOffset
	}

	return transport.NTPStatusData{
		IsSynced:  absOffset < 500*time.Millisecond,
		OffsetMS:  float64(offset.Milliseconds()),
		NTPServer: ntpServer,
	}
}

func queryNTPOffset(server string) (time.Duration, error) {
	conn, err := net.DialTimeout("udp", server, 5*time.Second)
	if err != nil {
		return 0, err
	}
	defer conn.Close()

	conn.SetDeadline(time.Now().Add(5 * time.Second))

	// NTP request packet (48 bytes, LI=0, VN=3, Mode=3)
	req := make([]byte, 48)
	req[0] = 0x1B // LI=0, VN=3, Mode=3 (client)

	t1 := time.Now()
	if _, err := conn.Write(req); err != nil {
		return 0, err
	}

	resp := make([]byte, 48)
	if _, err := conn.Read(resp); err != nil {
		return 0, err
	}
	t4 := time.Now()

	// Parse transmit timestamp from bytes 40-47
	secs := uint64(resp[40])<<24 | uint64(resp[41])<<16 | uint64(resp[42])<<8 | uint64(resp[43])
	frac := uint64(resp[44])<<24 | uint64(resp[45])<<16 | uint64(resp[46])<<8 | uint64(resp[47])

	// NTP epoch is Jan 1, 1900; Unix epoch is Jan 1, 1970
	const ntpEpochOffset = 2208988800
	ntpTime := time.Unix(int64(secs)-ntpEpochOffset, int64(frac)*1e9>>32)

	offset := ntpTime.Sub(t1.Add(t4.Sub(t1) / 2))
	return offset, nil
}
