# Changelog

## v1.0.0 — 2026-04-13

### Features
- Real-time device monitoring (CPU, RAM, disk, network, temperature)
- Software inventory with update detection
- Remote command execution with live output
- Event log collection (syslog, journalctl)
- Alert engine with auto-resolution for CPU/RAM/disk thresholds
- Device screenshot capture (Linux/macOS/Windows)
- NTP sync status monitoring
- Process list collection
- Device grouping and tagging
- Scheduled commands
- Notification rules with email delivery
- Audit logging
- Dark/light theme
- Global search
- Network topology map
- Device comparison
- Software update management

### Agent
- Single binary, cross-platform (Linux amd64/arm64, macOS, Windows)
- Exponential backoff reconnection
- Priority-aware send buffer (critical messages never dropped)
- One-liner install script

### Infrastructure
- Docker Compose deployment
- PostgreSQL + TimescaleDB for metrics
- Redis for caching and screenshots
- Nginx reverse proxy with TLS
