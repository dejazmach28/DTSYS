#!/usr/bin/env bash
set -euo pipefail

mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/C=US/ST=Dev/L=Dev/O=DTSYS/CN=localhost"

cat <<'EOF'
Generated development certificates:
  nginx/ssl/cert.pem
  nginx/ssl/key.pem

Trusting the certificate:
  Linux: import cert.pem into your browser or system trust store.
  macOS: open Keychain Access, import cert.pem, and set it to Always Trust.
  Windows: open cert.pem and install it into Trusted Root Certification Authorities.
EOF
