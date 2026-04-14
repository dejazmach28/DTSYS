# Security Audit — v1.2

## Findings

### HIGH
- Unbounded WebSocket message size allowed device‑side memory exhaustion → Added a 256KB cap in the WebSocket receive loop and reject oversized frames.
- Screenshot payload could store arbitrarily large base64 in Redis → Added max base64 size checks before storing.
- Unlimited queued commands per device allowed DoS via command spam → Enforced a 100 pending/sent command limit per device.
- Refresh tokens could not be revoked on logout → Added `/auth/logout` and refresh‑token revocation check.

### MEDIUM
- Event messages could be excessively large or frequent → Truncated event message/source, capped raw_data size, and added server‑side rate limiting per device.

### LOW / INFORMATIONAL
- Installer and download endpoints use fixed filenames and safe path resolution (no traversal). Verified.
- Device WS authentication is bound to URL device_id (device cannot impersonate another ID). Verified.
- Default admin credentials are still possible in dev; production should set strong values. Documented in `.env.example`.

## Dependency Vulnerabilities

### Python (pip-audit)
- `pip 25.3` → CVE‑2026‑1703 (fix in 26.0). No released fix yet; will bump when 26.0 is available.

### JavaScript (npm audit)
- **Resolved** by upgrading `vite` to 8.x and adding overrides for `follow-redirects` + `esbuild`. `npm audit` now reports 0 vulnerabilities.

### Go (govulncheck)
- Go stdlib vulnerabilities in `go1.22.4` (crypto/tls, crypto/x509, net/http, net/url, os, etc.). Fix requires Go toolchain >= 1.25.9.
- **Mitigation applied:** Go module version bumped to `go 1.25` so builds use the patched toolchain.
