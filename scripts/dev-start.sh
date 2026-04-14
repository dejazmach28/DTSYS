#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
BOLD='\033[1m'
RESET='\033[0m'

PIDS=()

print_error() {
  printf '%b\n' "${RED}Error:${RESET} $1" >&2
}

print_info() {
  printf '%b\n' "${BOLD}$1${RESET}"
}

cleanup() {
  printf '\nStopping DTSYS...\n'
  if [ "${#PIDS[@]}" -gt 0 ]; then
    kill "${PIDS[@]}" 2>/dev/null || true
  fi
  pkill -P $$ 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    print_error "$2"
    exit 1
  fi
}

version_ge() {
  local current="$1"
  local required="$2"
  local current_major current_minor required_major required_minor
  current_major="${current%%.*}"
  current_minor="${current#*.}"
  current_minor="${current_minor%%.*}"
  required_major="${required%%.*}"
  required_minor="${required#*.}"
  required_minor="${required_minor%%.*}"

  if [ "$current_major" -gt "$required_major" ]; then
    return 0
  fi
  if [ "$current_major" -lt "$required_major" ]; then
    return 1
  fi
  [ "$current_minor" -ge "$required_minor" ]
}

check_prerequisites() {
  require_command docker "Docker is required"
  if ! docker compose version >/dev/null 2>&1; then
    print_error "Docker Compose is required"
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    print_error "Docker daemon is not running"
    exit 1
  fi

  require_command go "Go 1.22+ is required"
  local go_version
  go_version="$(go version | sed -E 's/^go version go([0-9]+\.[0-9]+).*/\1/')"
  if ! version_ge "$go_version" "1.22"; then
    print_error "Go 1.22+ is required, found $go_version"
    exit 1
  fi

  require_command node "Node 20+ is required"
  local node_version
  node_version="$(node --version | sed 's/^v//')"
  if ! version_ge "$node_version" "20.0"; then
    print_error "Node 20+ is required, found $node_version"
    exit 1
  fi

  require_command openssl "openssl is required"
  require_command python3 "python3 is required"
}

ensure_certs() {
  if [ -f nginx/ssl/cert.pem ]; then
    echo "SSL certs already exist, skipping"
    return
  fi
  bash scripts/generate_certs.sh
  echo "SSL certs generated"
}

ensure_env() {
  if [ -f .env ]; then
    echo "Using existing .env, skipping"
  else
    local postgres_password redis_password secret_key
    postgres_password="$(openssl rand -hex 16)"
    redis_password="$(openssl rand -hex 16)"
    secret_key="$(openssl rand -hex 32)"

    cat > .env <<EOF
POSTGRES_DB=dtsys
POSTGRES_USER=dtsys
POSTGRES_PASSWORD=${postgres_password}
REDIS_PASSWORD=${redis_password}
SECRET_KEY=${secret_key}
FIRST_ADMIN_PASSWORD=admin123
DATABASE_URL=postgresql+asyncpg://dtsys:${postgres_password}@localhost:5432/dtsys
REDIS_URL=redis://:${redis_password}@localhost:6379/0
BASE_URL=http://localhost:8000
EOF
    echo "Created .env with generated secrets"
    echo ".env created - DO NOT COMMIT THIS FILE"
  fi

  ln -sf ../.env server/.env
}

wait_for_service() {
  local container_name="$1"
  local ready_message="$2"
  local deadline=15
  local status=''

  while [ "$deadline" -gt 0 ]; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || true)"
    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      echo "$ready_message"
      return 0
    fi
    sleep 2
    deadline=$((deadline - 1))
  done

  print_error "Timed out waiting for ${container_name}"
  exit 1
}

install_server_deps() {
  (
    cd server
    if [ ! -d .venv ]; then
      python3 -m venv .venv
    fi
    .venv/bin/pip install -e ".[dev]" -q
  )
  echo "Server dependencies installed"
}

run_migrations() {
  if ! (cd server && .venv/bin/alembic upgrade head); then
    print_error "Alembic migrations failed"
    exit 1
  fi
  echo "Database migrations applied"
}

install_frontend_deps() {
  (cd frontend && npm install --silent)
  echo "Frontend dependencies installed"
}

build_agent_binaries() {
  if command -v go >/dev/null 2>&1; then
    echo "Building agent binaries..."
    (cd client && GOOS=linux GOARCH=amd64 go build -o ../dist/agents/dtsys-agent-linux-amd64 ./cmd/agent/ 2>/dev/null || true)
    echo "Agent binaries built"
  fi
}

run_prefixed() {
  local label="$1"
  local color="$2"
  local command="$3"

  (
    bash -lc "$command" 2>&1 | while IFS= read -r line; do
      printf '%b[%s]%b %s\n' "$color" "$label" "$RESET" "$line"
    done
  ) &
  PIDS+=("$!")
}

print_summary() {
  cat <<'EOF'
┌─────────────────────────────────────────┐
│  DTSYS Development Environment          │
├─────────────────────────────────────────┤
│  Dashboard:  https://localhost:3000     │
│  API:        http://localhost:8000      │
│  API Docs:   http://localhost:8000/docs │
│  pgAdmin:    http://localhost:5050      │
│  Redis UI:   http://localhost:8081      │
│                                         │
│  Login:  admin / admin123               │
│                                         │
│  Press Ctrl+C to stop all services      │
└─────────────────────────────────────────┘
EOF
}

check_prerequisites
ensure_certs
ensure_env

docker compose -f docker-compose.dev.yml up -d
wait_for_service "dtsys-dev-postgres" "Postgres ready"
wait_for_service "dtsys-dev-redis" "Redis ready"

install_server_deps
run_migrations
install_frontend_deps

build_agent_binaries
run_prefixed "SERVER" "$CYAN" "cd '$ROOT_DIR/server' && .venv/bin/uvicorn app.main:app --reload --port 8000 --timeout-keep-alive 300"
run_prefixed "FRONTEND" "$GREEN" "cd '$ROOT_DIR/frontend' && npm run dev"
run_prefixed "WORKER" "$YELLOW" "cd '$ROOT_DIR/server' && .venv/bin/celery -A app.tasks.celery_app worker --loglevel=warning"

if [ -f /tmp/dtsys-test.toml ]; then
  run_prefixed "AGENT" "$YELLOW" "cd '$ROOT_DIR/client' && go run ./cmd/agent/ --config /tmp/dtsys-test.toml"
else
  echo "Agent config /tmp/dtsys-test.toml not found, skipping agent startup"
fi

print_summary
wait
