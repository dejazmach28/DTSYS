#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
fi

read -r -p "Postgres password: " POSTGRES_PASSWORD
read -r -p "Redis password: " REDIS_PASSWORD
read -r -p "Secret key (JWT): " SECRET_KEY
read -r -p "Initial admin password: " FIRST_ADMIN_PASSWORD

if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$REDIS_PASSWORD" ] || [ -z "$SECRET_KEY" ] || [ -z "$FIRST_ADMIN_PASSWORD" ]; then
  echo "Error: all secrets are required." >&2
  exit 1
fi

if [ "$(uname)" = "Darwin" ]; then
  SED_INPLACE=("sed" "-i" "")
else
  SED_INPLACE=("sed" "-i")
fi

"${SED_INPLACE[@]}" "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASSWORD}/" .env
"${SED_INPLACE[@]}" "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASSWORD}/" .env
"${SED_INPLACE[@]}" "s/^SECRET_KEY=.*/SECRET_KEY=${SECRET_KEY}/" .env
"${SED_INPLACE[@]}" "s/^FIRST_ADMIN_PASSWORD=.*/FIRST_ADMIN_PASSWORD=${FIRST_ADMIN_PASSWORD}/" .env

if [ ! -f nginx/ssl/cert.pem ] || [ ! -f nginx/ssl/key.pem ]; then
  bash scripts/generate_certs.sh
fi

docker compose -f docker-compose.prod.yml up -d

docker compose -f docker-compose.prod.yml exec server alembic upgrade head
docker compose -f docker-compose.prod.yml exec server python -m app.cli create-admin

echo "Production setup complete."
