#!/usr/bin/env bash
set -euo pipefail

ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"
BASE_URL="${BASE_URL:-http://localhost}"
DB_URL="${DB_URL:-postgresql://dtsys:dtsys@localhost:5432/dtsys}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

rows=()
failed=0

check() {
  local component="$1"
  local details="$2"
  local status="$3"
  rows+=("$component|$status|$details")
  if [[ "$status" != "OK" ]]; then
    failed=1
  fi
}

for name in postgres redis server frontend nginx; do
  if docker ps --format '{{.Names}}' | grep -q "$name"; then
    check "container:$name" "running" "OK"
  else
    check "container:$name" "not running" "FAIL"
  fi
done

if curl -fsS "$BASE_URL/health" | grep -q '"status":"ok"'; then
  check "http:/health" "healthy" "OK"
else
  check "http:/health" "unexpected response" "FAIL"
fi

token="$(curl -fsS -X POST "$BASE_URL/api/v1/auth/login" -H 'Content-Type: application/json' -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))' || true)"
if [[ -n "$token" ]] && curl -fsS "$BASE_URL/api/v1/devices" -H "Authorization: Bearer $token" >/dev/null; then
  check "http:/api/v1/devices" "authorized request succeeded" "OK"
else
  check "http:/api/v1/devices" "authorized request failed" "FAIL"
fi

if psql "$DB_URL" -c 'select 1' >/dev/null 2>&1; then
  check "postgresql" "connection ok" "OK"
else
  check "postgresql" "connection failed" "FAIL"
fi

if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping | grep -q PONG; then
  check "redis" "PING ok" "OK"
else
  check "redis" "PING failed" "FAIL"
fi

printf "%-24s %-8s %s\n" "Component" "Status" "Details"
printf "%-24s %-8s %s\n" "---------" "------" "-------"
for row in "${rows[@]}"; do
  IFS='|' read -r component status details <<<"$row"
  printf "%-24s %-8s %s\n" "$component" "$status" "$details"
done

exit "$failed"
