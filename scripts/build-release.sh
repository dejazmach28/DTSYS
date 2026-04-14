#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/client"

mkdir -p ../dist

GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o ../dist/dtsys-agent-linux-amd64 ./cmd/agent/
GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o ../dist/dtsys-agent-linux-arm64 ./cmd/agent/
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o ../dist/dtsys-agent-darwin-amd64 ./cmd/agent/
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o ../dist/dtsys-agent-darwin-arm64 ./cmd/agent/
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o ../dist/dtsys-agent-windows.exe ./cmd/agent/

echo "Built all agent binaries in dist/"
