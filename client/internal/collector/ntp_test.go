package collector

import "testing"

func TestCollectNTPStatus(t *testing.T) {
	status := CollectNTPStatus()

	if status.NTPServer == "" {
		t.Fatal("expected NTP server to be populated")
	}
	if status.OffsetMS < -86400000 || status.OffsetMS > 86400000 {
		t.Fatalf("unexpected offset: %v", status.OffsetMS)
	}
}
