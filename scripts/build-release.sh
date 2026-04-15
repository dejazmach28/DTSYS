#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/client"

mkdir -p ../dist
VERSION="$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//')"
if [ -z "$VERSION" ]; then
  VERSION="0.0.0"
fi

GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o ../dist/dtsys-agent-linux-amd64 ./cmd/agent/
GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o ../dist/dtsys-agent-linux-arm64 ./cmd/agent/
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o ../dist/dtsys-agent-darwin-amd64 ./cmd/agent/
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o ../dist/dtsys-agent-darwin-arm64 ./cmd/agent/
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o ../dist/dtsys-agent-windows-amd64.exe ./cmd/agent/

echo "$VERSION" > ../dist/version.txt

echo "Built all agent binaries in dist/"
