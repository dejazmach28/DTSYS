package collector

import "testing"

func TestCollectNTPStatus(t *testing.T) {
	status := CollectNTPStatus()

	if status.NTPServer == "" {
		t.Fatal("expected NTP server to be populated")
	}
	offset := status.EstimatedOffsetMS
	if offset == 0 {
		offset = status.OffsetMS
	}
	if offset < -86400000 || offset > 86400000 {
		t.Fatalf("unexpected offset: %v", offset)
	}
}
