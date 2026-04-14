#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: curl -fsSL http://YOUR_SERVER/install-agent.sh | sudo bash -s -- --server http://YOUR_SERVER --token ENROLLMENT_TOKEN" >&2
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

SERVER_URL=""
ENROLLMENT_TOKEN=""

while [ $# -gt 0 ]; do
  case "$1" in
    --server)
      SERVER_URL="${2:-}"
      shift 2
      ;;
    --token)
      ENROLLMENT_TOKEN="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ -z "$SERVER_URL" ] || [ -z "$ENROLLMENT_TOKEN" ]; then
  echo "Error: --server and --token are required." >&2
  usage
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: run as root (use sudo)." >&2
  exit 1
fi

OS="$(uname -s)"
ARCH_RAW="$(uname -m)"

PLATFORM=""
if [ "$OS" = "Linux" ]; then
  if [ -f /proc/version ] && grep -qi microsoft /proc/version; then
    PLATFORM="windows"
  else
    PLATFORM="linux"
  fi
elif [ "$OS" = "Darwin" ]; then
  PLATFORM="darwin"
else
  echo "Unsupported OS: $OS" >&2
  exit 1
fi

case "$ARCH_RAW" in
  x86_64|amd64)
    ARCH="amd64"
    ;;
  aarch64|arm64)
    ARCH="arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH_RAW" >&2
    exit 1
    ;;
esac

if [ "$PLATFORM" = "windows" ]; then
  echo "WSL detected; downloading Windows agent binary." >&2
fi

BIN_URL="${SERVER_URL}/api/v1/agent/download?arch=${ARCH}&platform=${PLATFORM}"
INSTALL_DIR="/usr/local/bin"
BIN_PATH="${INSTALL_DIR}/dtsys-agent"
if [ "$PLATFORM" = "windows" ]; then
  BIN_PATH="${INSTALL_DIR}/dtsys-agent.exe"
fi

mkdir -p "$INSTALL_DIR"
echo "Downloading agent from ${BIN_URL}..."
curl -fsSL "$BIN_URL" -o "$BIN_PATH"
chmod +x "$BIN_PATH"

HOSTNAME="$(hostname)"
OS_VERSION="$(uname -r)"
if [ "$PLATFORM" = "darwin" ]; then
  OS_VERSION="$(sw_vers -productVersion)"
fi

FINGERPRINT="$(printf '%s' "$HOSTNAME" | openssl dgst -sha256 | awk '{print $2}')"

HOSTNAME_VALUE="$HOSTNAME" PLATFORM_VALUE="$PLATFORM" OS_VERSION_VALUE="$OS_VERSION" ARCH_VALUE="$ARCH" FINGERPRINT_VALUE="$FINGERPRINT" TOKEN_VALUE="$ENROLLMENT_TOKEN" \
ENROLL_PAYLOAD="$(python3 - <<'PY'
import json, os
payload = {
  "hostname": os.environ.get("HOSTNAME_VALUE"),
  "os_type": os.environ.get("PLATFORM_VALUE"),
  "os_version": os.environ.get("OS_VERSION_VALUE"),
  "arch": os.environ.get("ARCH_VALUE"),
  "fingerprint": os.environ.get("FINGERPRINT_VALUE"),
  "enrollment_token": os.environ.get("TOKEN_VALUE"),
}
print(json.dumps(payload))
PY
)"

ENROLL_RESPONSE="$(curl -fsS -X POST "${SERVER_URL}/api/v1/enroll" \
  -H 'Content-Type: application/json' \
  -d "${ENROLL_PAYLOAD}")"

DEVICE_ID="$(printf '%s' "$ENROLL_RESPONSE" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("device_id",""))')"
API_KEY="$(printf '%s' "$ENROLL_RESPONSE" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("api_key",""))')"

if [ -z "$DEVICE_ID" ] || [ -z "$API_KEY" ]; then
  echo "Enrollment failed: ${ENROLL_RESPONSE}" >&2
  exit 1
fi

CONFIG_DIR="/etc/dtsys"
CONFIG_PATH="${CONFIG_DIR}/agent.toml"
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_PATH" <<EOF
[server]
url = "${SERVER_URL}"
device_id = "${DEVICE_ID}"
api_key = "${API_KEY}"

[agent]

[collect]
telemetry_interval_secs = 60
software_scan_interval_m = 60
event_poll_interval_secs = 120

[events]
dedup_max_entries = 50
exclude_patterns = ["event handler.*EOF", "event streamer.*EOF"]
rate_limit_max = 20
rate_limit_window_s = 30
EOF
chmod 600 "$CONFIG_PATH"

if [ "$PLATFORM" = "linux" ]; then
  SERVICE_PATH="/etc/systemd/system/dtsys-agent.service"
  cat > "$SERVICE_PATH" <<EOF
[Unit]
Description=DTSYS Agent
After=network.target

[Service]
Type=simple
ExecStart=${BIN_PATH} --config ${CONFIG_PATH}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now dtsys-agent
elif [ "$PLATFORM" = "darwin" ]; then
  PLIST_PATH="/Library/LaunchDaemons/com.dtsys.agent.plist"
  cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.dtsys.agent</string>
    <key>ProgramArguments</key>
    <array>
      <string>${BIN_PATH}</string>
      <string>--config</string>
      <string>${CONFIG_PATH}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
  </dict>
</plist>
EOF
  launchctl load -w "$PLIST_PATH"
fi

echo "DTSYS agent installed successfully. Device ID: ${DEVICE_ID}"
