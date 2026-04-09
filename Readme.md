# DTSYS — Device Management System

Advanced IT device management platform for managing many endpoints from a single dashboard.

## Architecture

| Component | Technology |
|---|---|
| Server API | Python 3.12 + FastAPI (async) |
| Database | PostgreSQL 16 + TimescaleDB |
| Cache / Queue | Redis 7 + Celery |
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Client Agent | Go 1.22 (single binary, all platforms) |
| Communication | WebSocket (persistent) + REST (registration) |
| Deployment | Docker Compose |

## Features

**Client Agent (Windows / Linux / macOS)**
- Hardware telemetry: CPU, RAM, disk, temperature, uptime
- Software inventory with update detection
- System event log (crashes, errors, warnings)
- NTP time sync monitoring
- Runs as system service / daemon
- Auto-registers on first boot with enrollment token

**Server Dashboard**
- Real-time device grid (online/offline/alert status)
- Per-device detail view with 24h performance charts
- Remote shell command execution
- Quick actions: check updates, reboot
- Alert engine: offline, high CPU/RAM/disk/temp, time drift, crashes
- Software inventory with update badges
- Event log per device
- User management (admin/viewer roles)
- Enrollment token generation for mass deployment

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env — set strong passwords and SECRET_KEY
```

### 2. Start the stack

```bash
docker compose up -d
```

Dashboard available at `https://localhost` after startup.
Default credentials: `admin` / value of `FIRST_ADMIN_PASSWORD` in `.env`

### 3. Deploy an agent

In the dashboard: **Settings → Generate Enrollment Token**, then on the target machine:

**Linux (one-liner):**
```bash
curl -sSL https://your-server/install.sh | SERVER_URL=https://your-server ENROLLMENT_TOKEN=xxx bash
```

**Windows (PowerShell, as Administrator):**
```powershell
$env:SERVER_URL="https://your-server"; $env:ENROLLMENT_TOKEN="xxx"
# Download and run the Windows installer from your server
```

### 4. Build the agent manually

```bash
cd client
go mod download
go build ./cmd/agent/...
```

Cross-compile for all platforms:
```bash
GOOS=linux   GOARCH=amd64  go build -o dist/dtsys-agent-linux-amd64  ./cmd/agent/
GOOS=windows GOARCH=amd64  go build -o dist/dtsys-agent-windows.exe  ./cmd/agent/
GOOS=darwin  GOARCH=arm64  go build -o dist/dtsys-agent-darwin-arm64 ./cmd/agent/
```

## Development

### Server
```bash
cd server
pip install uv
uv pip install -e ".[dev]"
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Client agent (local test)
```bash
cd client
go run ./cmd/agent/ --config /path/to/agent.toml
```

## Project Structure

```
DTSYS/
├── server/           FastAPI backend
│   └── app/
│       ├── api/v1/   REST endpoints
│       ├── websocket/ WebSocket handler + connection manager
│       ├── models/   SQLAlchemy ORM models
│       ├── services/ Business logic
│       └── tasks/    Celery background tasks
├── client/           Go agent
│   ├── cmd/agent/    Entry point
│   └── internal/
│       ├── collector/ Hardware, software, NTP collectors
│       ├── transport/ WebSocket client
│       └── executor/  Remote command execution
├── frontend/         React dashboard
│   └── src/
│       ├── pages/    Dashboard, DeviceDetail, Alerts, Settings
│       ├── components/
│       └── hooks/    react-query data hooks
├── nginx/            Reverse proxy config
├── scripts/          Deployment helpers
└── docker-compose.yml
```

## Security Notes

- Agent API keys stored as bcrypt hashes server-side
- Agent config is `chmod 600` on Linux/macOS
- Commands dispatched only over authenticated WebSocket
- Enrollment tokens are single-use (TODO: Redis expiry enforcement)
- CORS locked to your domain in production mode
