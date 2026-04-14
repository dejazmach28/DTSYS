# Security Audit — DTSYS v1.3.0

**Date:** 2026-04-14  
**Auditor:** Internal security review (automated + manual)  
**Scope:** Server (Python/FastAPI), Client (Go agent), Frontend (React/Vite), Mobile (Expo)

---

## 1. Automated Scans

### 1.1 Python — pip-audit

| CVE | Package | Severity | Notes |
|-----|---------|----------|-------|
| CVE-2026-1703 | pip 25.3 | Low | Tool dependency only — not deployed into application runtime. No action required. |

**Result:** No application-level Python vulnerabilities.

### 1.2 JavaScript/Node — npm audit

Ran against `frontend/` and `mobile/`.

**Result:** 0 vulnerabilities in both packages.

### 1.3 Go — govulncheck

Ran against `client/`. Identified 17 vulnerabilities in the Go standard library, all fixed in go 1.25.9. The `go.mod` previously specified `go 1.25` (resolves to 1.25.0).

**Fix:** Updated `client/go.mod` to `go 1.25.9`.

**Result after fix:** All govulncheck findings resolved.

---

## 2. Manual Review

### 2.1 Authentication & Authorization

**JWT token structure:** `sub` (user ID), `role`, `org_id`. Tokens are signed with `SECRET_KEY` from environment; the default dev key is `dev-secret-key-change-in-production` and must be overridden in production.

**Recommendation:** Enforce `SECRET_KEY` minimum length (≥ 32 bytes) at startup and refuse to start if the default value is detected in a production environment.

**Org isolation:** All device-related queries filter by `org_id` extracted from the JWT via `get_current_org_id()`. Confirmed on: devices, alerts, commands, groups, scheduled commands, notification rules, events, metrics, software.

**Result:** PASS — org isolation is enforced at the query layer on all data endpoints.

### 2.2 Organization Switch Endpoint (`POST /organizations/{id}/switch`)

`_require_membership()` is called before any org-specific operation including switch. This prevents a user from switching into an org they are not a member of and obtaining a token scoped to that org.

**Result:** PASS.

### 2.3 Push Token Endpoint (`POST /push-tokens`, `DELETE /push-tokens/{token}`)

**Issues found and fixed:**

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| No token format validation — any arbitrary string accepted | HIGH | Added regex validation: `ExponentPushToken[...]` or alphanumeric raw token pattern |
| No per-user token limit — table flooding possible | MEDIUM | Enforced max 10 tokens per user; oldest token evicted on overflow |
| No platform field validation | LOW | Restricted to `ios` or `android` only |
| `DELETE` path parameter not validated | LOW | Added format check before DB query |

**Result after fixes:** PASS.

### 2.4 WebSocket Device Connection (`/ws/device/{device_id}`)

- Auth via HMAC-hashed API key, not user JWT. Each device has its own key stored as a bcrypt hash.
- Rate-limited: 10 connection attempts per IP per 60 seconds; excess attempts close the socket with code 4029.
- Message size capped at 256 KiB.
- Commands are only dispatched to the device that issued them; no cross-org command routing is possible at the WebSocket layer.
- Event rate-limited via Redis: max 100 events per 30 seconds per device.

**Result:** PASS.

### 2.5 Enrollment (`POST /enroll`)

- Rate-limited: 30 requests per minute per IP.
- Enrollment tokens are single-use (deleted from Redis after first use).
- Token TTL enforced by Redis key expiry (default 60 minutes from `ENROLLMENT_TOKEN_EXPIRE_MINUTES`).
- `org_id` bound to token at issuance; device is assigned to the issuing org.

**Result:** PASS.

### 2.6 CORS Policy

`ALLOWED_ORIGINS` defaults to `["http://localhost:3000"]` for development. In production this must be set to the actual frontend domain. No wildcard (`*`) is used.

**Recommendation:** Document `ALLOWED_ORIGINS` as a required production configuration value. Consider rejecting startup if `ENVIRONMENT=production` and `ALLOWED_ORIGINS` still contains localhost.

**Result:** PASS (with documentation recommendation).

### 2.7 Agent Version Endpoint (`GET /api/v1/agent/version`)

Intentionally unauthenticated — required for agent auto-update checks before a device is enrolled. Returns version string and download URL. No sensitive data (no org names, device IDs, or internal paths) is exposed. `download_url` is constructed from `request.base_url`, which reflects the server's own origin.

**Result:** ACCEPTABLE — unauthenticated by design; no information leak.

### 2.8 Public Status Page (`GET /status`, `GET /health`)

`/status`: Returns aggregate device counts and alert severity counts only. No org or device identifiers.  
`/health`: Returns DB/Redis connectivity status and uptime. No secrets or internal identifiers.

**Result:** PASS.

### 2.9 Security Headers

`SecurityHeadersMiddleware` sets:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`: strict `default-src 'self'` in production; permissive in development.

**Result:** PASS.

### 2.10 API Docs Exposure

`/docs` and `/redoc` are only enabled when `ENVIRONMENT != production`.

**Result:** PASS.

---

## 3. Summary of Changes Made

| File | Change |
|------|--------|
| `client/go.mod` | Updated `go 1.25` → `go 1.25.9` to resolve 17 stdlib vulnerabilities |
| `server/app/api/v1/push_tokens.py` | Added Expo/raw token format validation, per-user limit (max 10), platform field validation, DELETE input validation |

---

## 4. Remaining Recommendations (Non-Blocking)

1. **Secret key enforcement:** Reject startup in production if `SECRET_KEY` matches the default value.
2. **CORS production guard:** Log a warning (or refuse startup) if `ENVIRONMENT=production` and `ALLOWED_ORIGINS` contains `localhost`.
3. **Org switch rate limiting:** Consider a per-user rate limit on `POST /organizations/{id}/switch` to prevent token farming.
4. **Agent download auth:** If agent binaries contain proprietary code, consider requiring a valid enrollment token or API key to download from `/agent/download`.

---

## 5. Verdict

**No CRITICAL findings remain open.**  
**All HIGH findings have been fixed.**  
MEDIUM/LOW findings have been addressed or accepted with documentation.

DTSYS v1.3.0 is cleared to proceed from a security standpoint.
