#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "Error: .env not found. Run make dev first." >&2
  exit 1
fi

set -a
source .env
set +a

BASE_URL="${BASE_URL:-http://localhost:8000}"
WS_URL="$(printf '%s' "$BASE_URL" | sed -e 's#^https://#wss://#' -e 's#^http://#ws://#')"
CONFIG_PATH="/tmp/dtsys-test.toml"

json_get() {
  python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get(sys.argv[1], ""))' "$1"
}

if [ ! -f "$CONFIG_PATH" ]; then
  login_response="$(curl -fsS -X POST "${BASE_URL}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"admin\",\"password\":\"${FIRST_ADMIN_PASSWORD:-admin123}\"}")"
  access_token="$(printf '%s' "$login_response" | json_get access_token)"
  if [ -z "$access_token" ]; then
    echo "Error: failed to obtain access token from ${BASE_URL}" >&2
    exit 1
  fi

  enrollment_response="$(curl -fsS -X POST "${BASE_URL}/api/v1/admin/enrollment-tokens" \
    -H "Authorization: Bearer ${access_token}")"
  enrollment_token="$(printf '%s' "$enrollment_response" | json_get enrollment_token)"
  if [ -z "$enrollment_token" ]; then
    echo "Error: failed to obtain enrollment token from ${BASE_URL}" >&2
    exit 1
  fi

  cat > "$CONFIG_PATH" <<EOF
[server]
url = "${WS_URL}"
enrollment_token = "${enrollment_token}"

[agent]

[collect]
telemetry_interval_secs = 10
software_scan_interval_m = 5
event_poll_interval_secs = 30

[events]
dedup_max_entries = 50
exclude_patterns = ["event handler.*EOF", "event streamer.*EOF"]
rate_limit_max = 20
rate_limit_window_s = 30
EOF
  echo "Agent config created at ${CONFIG_PATH}"
else
  echo "Using existing agent config"
  if grep -q "^telemetry_interval_secs" "$CONFIG_PATH"; then
    if [ "$(uname)" = "Darwin" ]; then
      sed -i '' 's/^telemetry_interval_secs.*/telemetry_interval_secs = 10/' "$CONFIG_PATH"
    else
      sed -i 's/^telemetry_interval_secs.*/telemetry_interval_secs = 10/' "$CONFIG_PATH"
    fi
  fi
fi

cd client
go run ./cmd/agent/ --config "$CONFIG_PATH"
