# DTSYS — Technical Overview
**Version 1.3.0 · April 2026**

---

## Table of Contents

1. [What Is DTSYS?](#1-what-is-dtsys)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Technology Stack](#3-technology-stack)
4. [The Agent (Go Client)](#4-the-agent-go-client)
   - [Platform Support](#41-platform-support)
   - [What It Collects](#42-what-it-collects)
   - [Commands It Can Execute](#43-commands-it-can-execute)
   - [How It Connects](#44-how-it-connects)
   - [Known Limitation — Screenshot](#45-known-limitation--screenshot)
5. [The Server (FastAPI Backend)](#5-the-server-fastapi-backend)
   - [API Endpoints](#51-api-endpoints)
   - [WebSocket Handler](#52-websocket-handler)
   - [Background Workers (Celery)](#53-background-workers-celery)
   - [Rate Limiting](#54-rate-limiting)
6. [Database Design](#6-database-design)
   - [All Tables](#61-all-tables)
   - [Relationship Map](#62-relationship-map)
   - [TimescaleDB — Metrics Table](#63-timescaledb--metrics-table)
7. [Web Dashboard (React Frontend)](#7-web-dashboard-react-frontend)
   - [Pages](#71-pages)
   - [Real-Time Features](#72-real-time-features)
8. [Mobile App (React Native)](#8-mobile-app-react-native)
9. [Compliance Engine](#9-compliance-engine)
10. [Audit Log](#10-audit-log)
11. [Alerting & Notifications](#11-alerting--notifications)
12. [Multi-Tenancy (Organizations)](#12-multi-tenancy-organizations)
13. [Security Model](#13-security-model)
14. [Infrastructure & Deployment](#14-infrastructure--deployment)
    - [Docker Compose](#141-docker-compose)
    - [Nginx](#142-nginx)
    - [Installation Scripts](#143-installation-scripts)
15. [Agent Installation by Platform](#15-agent-installation-by-platform)
    - [Linux](#151-linux)
    - [macOS](#152-macos)
    - [Windows](#153-windows)
16. [Development Environment](#16-development-environment)
17. [Release Pipeline (CI/CD)](#17-release-pipeline-cicd)
18. [Version History](#18-version-history)

---

## 1. What Is DTSYS?

DTSYS is a **self-hosted IT device management platform**. It lets you monitor, manage, and audit every machine in your fleet — Linux servers, Windows workstations, macOS laptops — all from one web dashboard or mobile app.

Key capabilities at a glance:

| Capability | Details |
|---|---|
| Real-time monitoring | CPU, RAM, disk, network I/O, temperature — live charts |
| Remote command execution | Run shell commands, scripts, reboot, update check — with live output |
| Software inventory | Full list of installed packages per device |
| Event log | Crashes, kernel panics, OOM kills, Windows Event Viewer errors |
| Alerting | Threshold alerts (CPU/RAM/disk/temp) + offline detection |
| Compliance policies | Define rules, auto-evaluate every device |
| Audit log | Every action by every user, exportable as CSV |
| Screenshot capture | Remote screenshot of the primary display |
| Process list | Running processes with CPU and memory usage |
| SSH key inventory | Discovery of all authorised keys on a device |
| NTP monitoring | Clock sync status and drift detection |
| Network topology | Visual map of device interfaces |
| Scheduled commands | Cron-based command execution |
| Multi-tenancy | Multiple organisations in one instance |
| Mobile app | iOS and Android companion app with push notifications |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Network                         │
│                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────┐  │
│  │ Linux    │   │ Windows  │   │ macOS    │   │ Any OS │  │
│  │ Agent    │   │ Agent    │   │ Agent    │   │ Agent  │  │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └───┬────┘  │
│       │              │              │              │        │
└───────┼──────────────┼──────────────┼──────────────┼────────┘
        │  WebSocket (wss://)         │              │
        └──────────────┬──────────────┘              │
                       ▼                             │
          ┌────────────────────────┐                 │
          │    Nginx Reverse Proxy │◄────────────────┘
          │    (TLS termination)   │
          └────────┬───────────────┘
                   │
        ┌──────────┴────────────┐
        │                       │
        ▼                       ▼
┌──────────────┐     ┌──────────────────┐
│  FastAPI     │     │  React Frontend  │
│  Server      │     │  (Web Dashboard) │
│  :8000       │     │  :3000           │
└──────┬───────┘     └──────────────────┘
       │
  ┌────┴─────────────────────┐
  │                          │
  ▼                          ▼
PostgreSQL               Redis
+ TimescaleDB            (cache, sessions,
(primary store)          screenshots, rate limits)
  │
  ▼
Celery Worker + Beat
(offline detection, cleanup,
 scheduled commands, notifications)
```

Every agent connects via **WebSocket** to the server. The server pushes commands down and agents stream telemetry, software lists, events, and command results back up. The frontend reads all of this via REST + Server-Sent Events (SSE).

---

## 3. Technology Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| **Agent** | Go | 1.22+ (cross-compiled for 5 targets) |
| **Agent system APIs** | gopsutil, os/exec | CPU/RAM/disk/network |
| **Server language** | Python | 3.12 |
| **Server framework** | FastAPI | Async, with Pydantic v2 |
| **ORM** | SQLAlchemy | Async (asyncpg driver) |
| **Migrations** | Alembic | 11 migration versions |
| **Task queue** | Celery + Celery Beat | Redis broker |
| **Primary database** | PostgreSQL 16 | |
| **Time-series extension** | TimescaleDB | Metrics hypertable |
| **Cache / broker** | Redis 7 | Screenshots stored 5 min TTL |
| **Frontend framework** | React 18 | TypeScript |
| **Frontend styling** | Tailwind CSS + shadcn/ui | Dark/light theme |
| **Frontend data fetching** | TanStack Query (React Query) | |
| **Mobile framework** | React Native + Expo | iOS & Android |
| **Reverse proxy** | Nginx | TLS termination, WebSocket upgrade |
| **Containerisation** | Docker + Docker Compose | Prod + dev configs |
| **MSI installer** | WiX Toolset v4 | Windows only |
| **Service management** | systemd (Linux), launchd (macOS), WinSW (Windows) | |
| **CI/CD** | GitHub Actions | 3-job pipeline (binaries + MSI + release) |

---

## 4. The Agent (Go Client)

The agent is a **single static binary** — no runtime dependencies, no installer required on the managed machine (other than the install script). It connects to the server, enrolls itself, and then loops forever sending data and executing commands.

### 4.1 Platform Support

| Platform | Architecture | Notes |
|---|---|---|
| Linux | amd64 | Primary target, full feature set |
| Linux | arm64 | Raspberry Pi, ARM servers |
| macOS | amd64 | Intel Macs |
| macOS | arm64 | Apple Silicon (M1/M2/M3) |
| Windows | amd64 | Full feature set including MSI installer |

All five binaries are built from the same codebase. Platform-specific code is isolated in `_linux.go`, `_darwin.go`, and `_windows.go` files — the Go build system picks the right file automatically at compile time.

### 4.2 What It Collects

The agent runs several independent goroutines, each collecting a different type of data and sending it via WebSocket:

#### Telemetry (every 30 seconds by default, configurable)

| Metric | Type | Notes |
|---|---|---|
| CPU usage | float, % | System-wide average |
| RAM usage | float, % | Used / total |
| RAM total | int, MB | |
| RAM used | int, MB | |
| Disk usage | float, % | Primary partition |
| Disk total | float, GB | |
| Disk used | float, GB | |
| Disk read speed | float, Mbps | Real-time I/O |
| Disk write speed | float, Mbps | Real-time I/O |
| Network sent | float, Mbps | All interfaces combined |
| Network received | float, Mbps | All interfaces combined |
| CPU temperature | float, °C | Where available |
| Uptime | int, seconds | |

#### Software Inventory (every 60 minutes by default, also on startup)

How packages are collected differs by OS:

| OS | Method | What Is Listed |
|---|---|---|
| **Linux (Debian/Ubuntu)** | `dpkg-query --show` | All .deb packages with versions |
| **Linux (RHEL/Fedora/CentOS)** | `rpm -qa --queryformat` | All .rpm packages with versions |
| **macOS** | `brew list --versions` + `system_profiler SPApplicationsDataType` | Homebrew packages + .app bundles |
| **Windows** | PowerShell — reads `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` | All programs in Add/Remove Programs |

The current device being tested reported **2,505 packages**.

#### System Events (every 60 seconds by default)

| OS | Source | Event Types Captured |
|---|---|---|
| **Linux** | `journalctl`, `/var/log/syslog` | Kernel panics, OOM kills, segfaults, service crashes |
| **macOS** | `/var/log/system.log` | Application crashes, kernel errors, panics |
| **Windows** | Windows Event Viewer (Application + System logs) | Errors and warnings from the last poll interval |

Events are deduplicated and rate-limited before sending (configurable max per window).

#### Network Info (every 10 minutes)

For each network interface:
- Interface name
- MAC address
- IPv4 addresses (array)
- IPv6 addresses (array)
- Up/down status
- MTU

#### Process List (every 5 minutes)

Top 15 processes sorted by CPU usage:
- PID
- Process name
- CPU %
- Memory %
- Status

#### SSH Keys (every 4 hours)

On Linux and macOS: discovers all public keys in `~/.ssh/authorized_keys` including key type, fingerprint, and comment. On Windows: limited discovery.

#### NTP Status (every 5 minutes)

- Whether the system clock is synchronised
- Time offset from reference
- NTP server responsiveness

#### Agent Info (on startup and periodically)

- Agent version
- Go runtime version
- OS details

### 4.3 Commands It Can Execute

Commands are dispatched by the server and executed by the agent. The agent sends back the output in real time.

| Command Type | What Happens | Platform | Details |
|---|---|---|---|
| `shell` | Runs an arbitrary shell command | All | Uses `/bin/sh -c` on Unix, `cmd /C` on Windows. Payload limit 10 KB. Timeout 60s default, max 300s. Captures stdout + stderr. Output capped at 1 MB. |
| `reboot` | Reboots the machine | All | Linux/macOS: `shutdown -r +1`. Windows: `shutdown /r /t 30`. |
| `update_check` | Lists available OS updates | All | Linux: `apt-get -s upgrade` or `dnf check-update`. macOS: `softwareupdate -l`. Windows: WMI COM object query. |
| `sync_time` | Forces NTP resync | All | Linux: tries `chronyc makestep`, then `timedatectl set-ntp true`, then `ntpdate`. macOS: `sntp -sS`. Windows: `w32tm /resync /force`. |
| `screenshot` | Captures the primary display | All | See [Section 4.5](#45-known-limitation--screenshot) for details and limitations. |
| `request_process_list` | Returns running process list immediately | All | Top 15 by CPU. Also runs on its own loop every 5 minutes. |
| `diagnostics` | Full device health dump | All | JSON report: agent version, OS info, all telemetry, network interfaces, NTP status, agent config (without secrets), top 10 processes, recent events, disk partitions. |

### 4.4 How It Connects

1. **Enrollment** — On first run, the agent reads an enrollment token from its config file and calls `POST /api/v1/enroll`. The server validates the token (one-time use, stored in Redis with TTL), creates a device record, and returns a permanent API key.
2. **Config persistence** — The device ID and API key are stored in the agent's config file (`/etc/dtsys/agent.toml` on Linux/macOS, `C:\Program Files\DTSYS\agent.toml` on Windows).
3. **WebSocket connection** — The agent opens `wss://<server>/ws/device/<device_id>?token=<api_key>` and keeps it alive with pings/reconnect logic (exponential backoff).
4. **Priority send buffer** — Messages are queued internally. Critical messages (command results, alerts) are never dropped even if the buffer is full.
5. **Clock skew resilience** — The agent can accept server-issued time and adjust behaviour if the local clock is significantly off (useful for machines that have been offline).

### 4.5 Known Limitation — Screenshot

Screenshot capture works fully on **Windows** and **macOS**. On **Linux**, it requires an active graphical session:

| Linux Situation | Behaviour |
|---|---|
| `$DISPLAY` not set (headless/SSH-only server) | Returns a grey placeholder image reading "NO DISPLAY / HEADLESS" |
| `$DISPLAY` set, `scrot` installed | Captures via scrot |
| `$DISPLAY` set, `xwd` + `convert` (ImageMagick) available | Captures via xwd pipeline |
| `$DISPLAY` set, `gnome-screenshot` available | Captures via gnome-screenshot |
| `$DISPLAY` set, `ffmpeg` available | Captures via ffmpeg x11grab |
| None of the above found | Returns the grey placeholder |

**Fix for headless Linux servers:** Install `scrot` (`apt install scrot`) and ensure a virtual display is running (e.g. Xvfb), or accept that screenshots are not meaningful for headless servers.

Screenshots are stored in Redis with a **5-minute TTL** — they are not persisted to the database. If you fetch the screenshot more than 5 minutes after requesting it, you get a 404.

---

## 5. The Server (FastAPI Backend)

The server is an async Python application using FastAPI. It handles:
- REST API for the dashboard and mobile app
- WebSocket connections from agents
- Streaming (SSE) for real-time dashboard updates

### 5.1 API Endpoints

All endpoints live under `/api/v1/`. All require a valid JWT Bearer token except `/auth/login` and `/enroll`.

#### Authentication

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Login with username + password. Returns access + refresh tokens. Rate limited: 10/min. |
| `POST` | `/auth/refresh` | Exchange refresh token for new access token. |
| `POST` | `/auth/logout` | Invalidate current session. |

#### Devices

| Method | Path | Description |
|---|---|---|
| `GET` | `/devices` | List all non-revoked devices in the current org. |
| `GET` | `/devices/{id}` | Get one device with full details. |
| `PATCH` | `/devices/{id}` | Update label, notes, tags, location, assigned_to, etc. |
| `DELETE` | `/devices/{id}` | Revoke (soft-delete) a device. |
| `POST` | `/devices/{id}/maintenance` | Enable/disable maintenance mode with optional reason and end time. |
| `GET` | `/devices/{id}/software` | List installed software packages. |
| `GET` | `/devices/{id}/metrics` | Time-series metrics with configurable window (1h to 30d). |
| `GET` | `/devices/{id}/events` | Event log for the device. |
| `GET` | `/devices/{id}/alerts` | Alerts for the device. |
| `GET` | `/devices/{id}/network` | Network interface details. |
| `GET` | `/devices/{id}/processes` | Last known process list. |
| `GET` | `/devices/{id}/ssh-keys` | Discovered SSH authorised keys. |
| `POST` | `/devices/{id}/screenshot/request` | Dispatch screenshot command to agent. |
| `GET` | `/devices/{id}/screenshot` | Retrieve latest screenshot from Redis (5-min TTL). |

#### Commands

| Method | Path | Description |
|---|---|---|
| `POST` | `/devices/{id}/commands` | Dispatch a command to a device. |
| `GET` | `/devices/{id}/commands` | List command history for a device. |
| `GET` | `/commands/{id}` | Get a specific command with output. |
| `POST` | `/commands/bulk` | Dispatch the same command to multiple devices. |

#### Alerts

| Method | Path | Description |
|---|---|---|
| `GET` | `/alerts` | List alerts. Filterable by device, severity, resolved status. |
| `PATCH` | `/alerts/{id}/resolve` | Manually resolve an alert. |

#### Software & Updates

| Method | Path | Description |
|---|---|---|
| `GET` | `/software` | Org-wide software inventory. |
| `GET` | `/software-updates` | Devices with available updates. |
| `GET` | `/software-catalog` | Software library catalog. |

#### Scheduling & Saved Commands

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/scheduled-commands` | List or create cron-based scheduled commands. |
| `PATCH/DELETE` | `/scheduled-commands/{id}` | Update or delete a scheduled command. |
| `GET/POST` | `/saved-commands` | List or create reusable command templates. |
| `DELETE` | `/saved-commands/{id}` | Delete a saved command. |

#### Notifications

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/notification-rules` | List or create notification routing rules. |
| `DELETE` | `/notification-rules/{id}` | Delete a rule. |

#### Compliance

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/compliance/policies` | List or create compliance policies. |
| `PATCH/DELETE` | `/compliance/policies/{id}` | Update or delete a policy. |
| `GET` | `/compliance/results` | All compliance evaluation results across the org. |
| `POST` | `/compliance/evaluate/{policy_id}` | Trigger immediate evaluation of a policy against all devices. |

#### Audit Log

| Method | Path | Description |
|---|---|---|
| `GET` | `/audit` | Paginated audit log. Filters: action, username, resource_type, since, until. Admin only. |
| `GET` | `/audit/export/csv` | Download full audit log as CSV. Admin only. |
| `GET` | `/audit/stream` | SSE stream of new audit log entries in real time. Admin only. |

#### Admin & Organizations

| Method | Path | Description |
|---|---|---|
| `POST` | `/admin/enrollment-tokens` | Generate a one-time enrollment token (72h default TTL). Admin only. |
| `GET/POST` | `/admin/users` | List or create user accounts. Admin only. |
| `PATCH/DELETE` | `/admin/users/{id}` | Update or delete a user. Admin only. |
| `GET/POST` | `/organizations` | List or create organisations. |
| `PATCH/DELETE` | `/organizations/{id}` | Update or delete an organisation. |
| `POST` | `/organizations/{id}/members` | Add a member to an org. |
| `DELETE` | `/organizations/{id}/members/{user_id}` | Remove a member. |

#### Tagging & Groups

| Method | Path | Description |
|---|---|---|
| `GET` | `/tags` | List all tags used across devices. |
| `GET/POST` | `/groups` | List or create device groups. |
| `PATCH/DELETE` | `/groups/{id}` | Update or delete a group. |
| `POST` | `/groups/{id}/members` | Add devices to a group. |

#### Inventory & Downloads

| Method | Path | Description |
|---|---|---|
| `GET` | `/inventory` | Aggregated hardware inventory across the org. |
| `GET` | `/agent/download` | Download the latest agent binary (platform-detected). |

#### Real-Time Streams

| Method | Path | Description |
|---|---|---|
| `GET` | `/events/stream` | SSE stream of new device events. |
| `GET` | `/activity/stream` | SSE stream of device activity (connect/disconnect/telemetry). |
| `GET` | `/audit/stream` | SSE stream of new audit log entries. |

### 5.2 WebSocket Handler

Each agent holds one persistent WebSocket connection. The server's WebSocket handler processes these inbound message types:

| Message Type | What the Server Does |
|---|---|
| `telemetry` | Writes a new row to `device_metrics`. Checks thresholds and creates/resolves alerts. Updates `device.last_seen` and `device.status = online`. |
| `software_inventory` | Upserts rows in `software_inventory`. Detects available updates. |
| `event_report` | Writes to `events`. May trigger crash/error alerts. |
| `ntp_status` | Stores NTP state on the device record. Creates time-drift alerts if offset is large. |
| `network_info` | Upserts rows in `device_network_info`. |
| `ssh_keys` | Upserts rows in `ssh_keys`. |
| `process_list` | Stored in Redis (not persisted to DB). Available via `/devices/{id}/processes`. |
| `agent_info` | Updates `device.agent_version`. |
| `command_result` | Updates the `commands` row: status, exit_code, output, completed_at. |
| `screenshot_result` | Validates size limit (4 MB). Stores base64 JPEG in Redis with 5-min TTL. |

### 5.3 Background Workers (Celery)

Celery Beat schedules these tasks:

| Task | Schedule | What It Does |
|---|---|---|
| `check_offline_devices` | Every 2 minutes | Marks devices as `offline` if no telemetry in the last 5 minutes. Creates offline alerts. |
| `run_scheduled_commands` | Every minute | Finds scheduled commands whose `next_run_at` is due. Dispatches them via WebSocket. Updates `last_run_at` and `next_run_at`. |
| `send_alert_notifications` | Every minute | Checks unacknowledged alerts against notification rules. Sends browser push, email, or webhook. |
| `cleanup_old_metrics` | Every hour | Deletes metrics older than `METRIC_RETENTION_DAYS` (default: 90 days). Also cleans old events, commands, and resolved alerts per their own retention settings. |
| `cleanup_stale_commands` | Every 10 minutes | Marks commands that have been in `sent` status for over 10 minutes as `failed` (agent probably disconnected before delivering the result). |

### 5.4 Rate Limiting

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 10 requests / minute |
| `POST /enroll` | 30 requests / minute |
| General API | 60 requests / minute |
| Push token registration | Max 10 tokens per user (oldest evicted) |

---

## 6. Database Design

### 6.1 All Tables

#### `devices`

The central table. One row per enrolled device.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated on enrollment |
| `hostname` | text | As reported by the OS |
| `os_type` | text | `windows`, `linux`, or `macos` |
| `os_version` | text | e.g. "Ubuntu 24.04" or "Windows 11 23H2" |
| `arch` | text | `amd64` or `arm64` |
| `ip_address` | text | Last known IP |
| `fingerprint` | text | SHA-256 of hostname — used to detect re-enrollment |
| `api_key_hash` | text | bcrypt hash of the device's permanent API key |
| `enrolled_at` | timestamptz | |
| `last_seen` | timestamptz | Updated on every telemetry message |
| `status` | text | `online`, `offline`, or `alert` |
| `is_revoked` | bool | Soft-delete flag |
| `label` | text | Human-friendly name |
| `notes` | text | Free text notes |
| `tags` | text[] | Array of string tags |
| `serial_number` | text | Hardware serial |
| `manufacturer` | text | e.g. Dell, Lenovo, Apple |
| `model_name` | text | e.g. ThinkPad X1 Carbon |
| `purchase_date` | date | |
| `warranty_expires` | date | |
| `location` | text | e.g. "Server Room B" |
| `assigned_to` | text | Name or email of responsible person |
| `asset_tag` | text | Your organisation's asset tracking ID |
| `maintenance_mode` | bool | Suppresses alerts while in maintenance |
| `maintenance_until` | timestamptz | Auto-exit maintenance at this time |
| `maintenance_reason` | text | |
| `agent_version` | text | e.g. "1.3.0" |
| `org_id` | UUID (FK → organisations) | Which organisation owns this device |

#### `device_metrics`

TimescaleDB hypertable. One row per telemetry report (every ~30 seconds per device).

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `time` | timestamptz | Partition key — indexed by TimescaleDB |
| `device_id` | UUID (FK → devices) | |
| `cpu_percent` | float | |
| `ram_percent` | float | |
| `disk_percent` | float | |
| `cpu_temp` | float | °C |
| `uptime_secs` | bigint | |
| `ram_total_mb` | bigint | |
| `ram_used_mb` | bigint | |
| `disk_total_gb` | float | |
| `disk_used_gb` | float | |
| `disk_read_mbps` | float | |
| `disk_write_mbps` | float | |
| `net_sent_mbps` | float | |
| `net_recv_mbps` | float | |

#### `commands`

One row per command dispatched to a device.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | |
| `device_id` | UUID (FK → devices) | |
| `issued_by` | UUID (FK → users) | Which user dispatched this |
| `command_type` | text | `shell`, `reboot`, `update_check`, `sync_time`, `screenshot`, `request_process_list`, `diagnostics` |
| `payload` | JSONB | e.g. `{"command": "ls -la", "timeout_secs": 30}` |
| `status` | text | `pending` → `sent` → `running` → `completed` or `failed` or `timeout` |
| `created_at` | timestamptz | |
| `started_at` | timestamptz | When agent acknowledged it |
| `completed_at` | timestamptz | |
| `exit_code` | int | OS exit code (0 = success) |
| `output` | text | Combined stdout + stderr |

#### `software_inventory`

One row per installed package per device.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `device_id` | UUID (FK → devices) | |
| `name` | text | Package name |
| `version` | text | Installed version |
| `install_date` | date | Where available |
| `update_available` | bool | Whether a newer version exists |
| `latest_version` | text | Latest version string if known |
| `last_scanned` | timestamptz | When this row was last updated |

#### `events`

System events from agents (crashes, errors, OOM kills, etc.).

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `time` | timestamptz | When the event occurred (indexed) |
| `device_id` | UUID (FK → devices) | |
| `event_type` | text | `crash`, `error`, `warning`, `info` |
| `source` | text | e.g. "kernel", "sshd", "ApplicationError" |
| `message` | text | Human-readable description |
| `raw_data` | JSONB | Full structured data from the source |

#### `alerts`

Threshold and state-based alerts.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `device_id` | UUID (FK → devices) | |
| `alert_type` | text | `offline`, `high_cpu`, `high_ram`, `high_temp`, `disk_full`, `crash`, `outdated_software`, `time_drift` |
| `severity` | text | `info`, `warning`, `critical` |
| `message` | text | Human-readable alert text |
| `is_resolved` | bool | |
| `created_at` | timestamptz | |
| `resolved_at` | timestamptz | |

#### `users`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `username` | text (unique) | Login name |
| `password_hash` | text | bcrypt hash |
| `role` | text | `admin` or `viewer` |
| `is_active` | bool | |
| `last_login` | timestamptz | |
| `created_at` | timestamptz | |
| `active_org_id` | UUID (FK → organisations) | The org this user is currently acting within |

#### `organisations`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `name` | text | Display name |
| `slug` | text (unique, indexed) | URL-safe identifier |
| `created_at` | timestamptz | |
| `owner_id` | UUID (FK → users) | |

#### `organisation_members`

Join table — who belongs to which org and in what role.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `org_id` | UUID (FK → organisations) | |
| `user_id` | UUID (FK → users) | |
| `role` | text | `owner`, `admin`, or `member` |
| `joined_at` | timestamptz | |

#### `device_groups`

Named collections of devices within an org.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `org_id` | UUID (FK → organisations) | |
| `name` | text | Unique within the org |
| `description` | text | |
| `color` | text | Hex colour for UI display |
| `created_at` | timestamptz | |
| `created_by` | UUID (FK → users) | |

#### `device_group_memberships`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `group_id` | UUID (FK → device_groups, CASCADE DELETE) | |
| `device_id` | UUID (FK → devices, CASCADE DELETE) | |

#### `device_config`

One-to-one with devices. Stores dynamic agent config pushed from server.

| Column | Type | Description |
|---|---|---|
| `device_id` | UUID (PK, FK → devices) | |
| `config` | JSONB | Telemetry interval, software scan interval, etc. |
| `updated_at` | timestamptz | |

#### `device_network_info`

One row per network interface per device.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `device_id` | UUID (FK → devices, indexed) | |
| `interface_name` | text | e.g. eth0, en0, Ethernet |
| `mac_address` | text | |
| `ipv4` | text[] | Array of IPv4 addresses |
| `ipv6` | text[] | Array of IPv6 addresses |
| `is_up` | bool | Whether the interface is active |
| `mtu` | int | |
| `updated_at` | timestamptz | |

#### `ssh_keys`

SSH public keys discovered on devices.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `device_id` | UUID (FK → devices, indexed) | |
| `key_type` | text | e.g. `ssh-rsa`, `ssh-ed25519` |
| `public_key` | text | Full public key string |
| `fingerprint` | text (indexed) | SHA-256 fingerprint |
| `comment` | text | The comment field of the key |
| `discovered_at` | timestamptz | |

#### `uptime_events`

Tracks device online/offline transitions.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `device_id` | UUID (FK → devices, indexed) | |
| `event_type` | text | `online` or `offline` |
| `timestamp` | timestamptz (indexed) | |
| `duration_secs` | bigint | Duration of the previous state |

#### `scheduled_commands`

Cron-based command templates.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `org_id` | UUID (FK → organisations, indexed) | |
| `device_id` | UUID (FK → devices, nullable) | Null = run on all org devices |
| `command_type` | text | |
| `payload` | JSONB | |
| `cron_expression` | text | Standard 5-field cron |
| `is_enabled` | bool | |
| `last_run_at` | timestamptz | |
| `next_run_at` | timestamptz (indexed) | Pre-computed, used by Celery |
| `created_by` | UUID (FK → users) | |
| `created_at` | timestamptz | |

#### `saved_commands`

Reusable command templates (command library).

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `name` | text (unique) | |
| `description` | text | |
| `command_type` | text | |
| `payload` | JSONB | |
| `created_by` | UUID (FK → users) | |
| `device_id` | UUID (FK → devices, nullable) | Pinned to a specific device if set |
| `is_global` | bool | Available to all users in the org |
| `created_at` | timestamptz | |

#### `notification_rules`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `org_id` | UUID (FK → organisations, indexed) | |
| `alert_type` | text | Which alert type triggers this rule |
| `severity_min` | text | Minimum severity that triggers (`info`, `warning`, `critical`) |
| `channel` | text | `browser`, `webhook`, or `email` |
| `webhook_url` | text | For webhook channel |
| `email_address` | text | For email channel |
| `is_enabled` | bool | |
| `created_at` | timestamptz | |

#### `compliance_policies`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `org_id` | UUID (FK → organisations, indexed) | |
| `name` | text | Unique within the org |
| `description` | text | |
| `is_active` | bool | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `rules` | JSONB | Array of rule objects — see Compliance section |

#### `compliance_results`

One row per device per policy (upserted on each evaluation).

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `device_id` | UUID (FK → devices, indexed) | |
| `policy_id` | UUID (FK → compliance_policies, indexed) | |
| `is_compliant` | bool | Overall pass/fail |
| `details` | JSONB | Per-rule results |
| `violations` | int | Count of failed rules |
| `evaluated_at` | timestamptz | |

#### `audit_log`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `timestamp` | timestamptz (indexed) | |
| `user_id` | UUID (FK → users) | |
| `username` | text | Denormalised for easy querying |
| `action` | text | e.g. `login_success`, `command_dispatched`, `device_deleted` |
| `resource_type` | text | e.g. `device`, `command`, `policy` |
| `resource_id` | text | UUID of the affected resource |
| `ip_address` | text | Client IP |
| `details` | JSONB | Extra context |

#### `push_tokens`

Expo push tokens for mobile notifications.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | |
| `user_id` | UUID (FK → users, indexed) | |
| `token` | text (unique) | Expo or raw APNs/FCM token |
| `platform` | text | `ios` or `android` |
| `created_at` | timestamptz | |
| `last_used` | timestamptz | |

Limit: 10 tokens per user. Oldest is evicted when the limit is reached.

### 6.2 Relationship Map

```
organisations
  ├── organisation_members ──► users
  ├── devices
  │     ├── device_metrics       (TimescaleDB hypertable)
  │     ├── commands
  │     ├── software_inventory
  │     ├── events
  │     ├── alerts
  │     ├── device_network_info
  │     ├── ssh_keys
  │     ├── uptime_events
  │     ├── device_config        (1:1)
  │     └── compliance_results ──► compliance_policies
  ├── device_groups
  │     └── device_group_memberships ──► devices
  ├── scheduled_commands
  ├── saved_commands
  ├── notification_rules
  └── compliance_policies
          └── compliance_results

users
  ├── push_tokens
  ├── commands               (issued_by)
  ├── device_groups          (created_by)
  ├── saved_commands         (created_by)
  └── scheduled_commands     (created_by)
```

### 6.3 TimescaleDB — Metrics Table

The `device_metrics` table is a **TimescaleDB hypertable** partitioned by `time`. This means:

- Queries like "give me all metrics for this device over the last 24 hours" are extremely fast — TimescaleDB only scans the relevant time chunks, not the whole table.
- Data older than `METRIC_RETENTION_DAYS` (default: 90 days) is deleted automatically by the Celery cleanup task.
- The table can hold billions of rows without performance degradation.
- A device sending telemetry every 30 seconds generates ~2,880 rows/day, ~259,200 rows/90 days.

---

## 7. Web Dashboard (React Frontend)

The frontend is a single-page application (SPA) built with React 18 and TypeScript. It communicates with the server via REST (TanStack Query) and real-time SSE streams.

### 7.1 Pages

| Page | URL | Who Can Access | What It Shows |
|---|---|---|---|
| **Dashboard** | `/` | All | Device count, alert summary, recent activity, top metrics |
| **Device Detail** | `/devices/:id` | All | Full device view — specs, live metrics charts, software list, event log, command panel, process list, network info, SSH keys, NTP status, screenshots |
| **Alerts** | `/alerts` | All | All alerts with severity filter, device filter, resolved/active toggle |
| **Inventory** | `/inventory` | All | Hardware inventory aggregation across all devices |
| **Software Updates** | `/software-updates` | All | Devices with available software updates |
| **Command Library** | `/command-library` | All | Saved/reusable command templates |
| **Scheduled Commands** | `/scheduled` | All | Cron schedule editor — create, enable/disable, delete |
| **Compliance** | `/compliance` | All | Policy list with per-device results, create policies with rule builder |
| **Audit Log** | `/audit` | **Admin only** | Paginated log with filters, CSV export, live SSE mode |
| **Organizations** | `/organizations` | Admin | Create and manage organisations, invite members |
| **Users** | `/users` | Admin | User account management |
| **Network Map** | `/network-map` | All | Visual network topology |
| **Device Compare** | `/compare` | All | Side-by-side comparison of two devices |
| **Custom Dashboard** | `/my-dashboard` | All | User-configurable widget dashboard |
| **Reports** | `/reports` | All | Analytics and reporting |
| **Settings** | `/settings` | All | Password change, preferences, organisation settings |
| **Onboarding** | `/onboarding` | Admin | First-run setup wizard (shown when no devices enrolled) |
| **Status** | `/status` | Public | System health check (no login required) |

### 7.2 Real-Time Features

| Feature | Transport | How It Works |
|---|---|---|
| Live metrics charts | REST polling (TanStack Query, 10s stale time) | Re-fetches on a stale window |
| Command output | WebSocket message forwarded by server | Agent streams output, server relays to browser |
| Device status badge | SSE via `/activity/stream` | Goes green/red immediately when agent connects or drops |
| Event log | SSE via `/events/stream` | New events appear in the log without a page refresh |
| Audit log live mode | SSE via `/audit/stream` | New audit entries stream in real time |
| Alert badge | SSE or polling | Alert count in the sidebar updates live |

---

## 8. Mobile App (React Native)

The mobile app provides a companion interface for iOS and Android. It uses the same REST API as the web dashboard.

### Screens

| Screen | Features |
|---|---|
| **Login** | Username/password authentication |
| **Dashboard** | Device list with status indicators, unresolved alert count, quick stats |
| **Device Detail** | Overview tab (specs, metrics) + Commands tab (v1.3) |
| **Commands tab** | Command history list, status indicators, dispatch new command, command library bottom sheet with one-tap dispatch, confirmation dialogs for dangerous commands (reboot), output modal |
| **Alerts** | Alert list with severity colour coding and filtering |
| **Settings** | Profile settings, push notification toggle |

### Push Notifications

- Uses **Expo Push Notifications** (wraps APNs for iOS and FCM for Android).
- When a new alert is created, the server sends a push notification to all registered tokens for users in the org.
- Token validation: accepts Expo format (`ExponentPushToken[...]`) and raw APNs/FCM tokens.
- Max 10 tokens per user — oldest evicted on registration when at limit.

### Command Execution (v1.3)

The mobile app can dispatch every command type the web dashboard can:
- Shell commands from the command library (pre-defined templates)
- `update_check` — check for OS updates
- `sync_time` — force NTP resync
- `reboot` — with a confirmation dialog
- `diagnostics` — full device report
- `screenshot` — with output preview
- `request_process_list` — live process view

Output is shown in a dark terminal-style modal. The app polls the command status every 2 seconds while it is `pending`, `sent`, or `running`.

---

## 9. Compliance Engine

The compliance engine lets you define policies with rules and automatically evaluate them against every device in your organisation.

### Rule Types

| Rule Type | Value | Passes If |
|---|---|---|
| `max_offline_hours` | Number (e.g. 24) | Device was seen within the last N hours |
| `disk_free_min_gb` | Number (e.g. 50) | Disk free space ≥ N GB |
| `max_disk_percent` | Number (e.g. 90) | Disk usage ≤ N% |
| `required_software` | String (package name) | That package is in the software inventory |
| `forbidden_software` | String (package name) | That package is NOT in the software inventory |
| `os_type` | String (`linux`, `windows`, `macos`) | Device OS matches |

### How Evaluation Works

1. Call `POST /compliance/evaluate/{policy_id}` or it runs automatically.
2. For each device in the org, the engine fetches the latest telemetry and software inventory.
3. It evaluates each rule and records pass/fail per rule.
4. Results are upserted into `compliance_results` — one row per device per policy.
5. The `violations` count tells you at a glance how many rules a device is failing.

### Compliance UI

- Policy cards are expandable — click to see per-device results.
- A rule builder lets you pick a rule type from a dropdown and enter a value, then click Add.
- Delete policies with a confirmation dialog.
- Results show which specific rules each device is failing.

---

## 10. Audit Log

Every significant action in the system is recorded in the audit log.

### Recorded Actions

| Action Key | When It Is Recorded |
|---|---|
| `login_success` | Successful login |
| `login_failed` | Failed login attempt |
| `device_enrolled` | A new agent enrolled |
| `device_deleted` | A device was revoked |
| `device_revoked` | A device was soft-deleted |
| `command_dispatched` | A command was sent to an agent |
| `org_created` | A new organisation was created |
| `org_deleted` | An organisation was deleted |
| `user_created` | A new user was created |
| `compliance_evaluated` | A compliance policy was evaluated |
| `policy_created` | A compliance policy was created |
| `policy_deleted` | A compliance policy was deleted |

### Accessing the Audit Log

- **Web**: `/audit` — paginated table with filters for action, username, resource type, and date range.
- **Export**: "Export CSV" button downloads the filtered log as a CSV file.
- **Live mode**: "Live" button opens an SSE stream — new entries appear in real time without polling.
- **API**: `GET /api/v1/audit` with query parameters.

Admin access is required for all audit log endpoints.

---

## 11. Alerting & Notifications

### Alert Types and Default Thresholds

| Alert Type | Severity | Trigger Condition |
|---|---|---|
| `offline` | critical | No telemetry received in last 5 minutes |
| `high_cpu` | warning | CPU > 90% for sustained period |
| `high_ram` | warning | RAM > 90% |
| `disk_full` | critical | Disk > 95% |
| `high_temp` | warning | CPU temp > 85°C |
| `crash` | critical | Crash event received from agent |
| `time_drift` | warning | NTP offset exceeds acceptable threshold |
| `outdated_software` | info | Software with known update detected |

### Auto-Resolution

Alerts resolve automatically when the condition clears:
- `offline` resolves when the agent reconnects.
- `high_cpu` / `high_ram` / `disk_full` / `high_temp` resolve when the metric drops below threshold.

### Notification Channels

| Channel | How It Delivers |
|---|---|
| `browser` | Web Push API (shown as OS notification in the browser) |
| `email` | SMTP email to the specified address |
| `webhook` | HTTP POST to the specified URL (e.g. Slack incoming webhook, PagerDuty) |

Notification rules are per org. You can combine multiple channels and set a minimum severity threshold per rule.

---

## 12. Multi-Tenancy (Organizations)

DTSYS supports multiple organisations in a single installation. Every resource (devices, policies, groups, notification rules, scheduled commands) is scoped to an organisation.

### Roles

| Role | What They Can Do |
|---|---|
| `owner` | Full control. Can delete the org. |
| `admin` | Can manage all resources, users, and settings. Cannot delete the org. |
| `member` | Can view all resources and dispatch commands. Cannot manage users or org settings. |

### Switching Orgs

Users can be members of multiple organisations. The `active_org_id` on the user record tracks which org they are currently acting within. The frontend shows an org switcher.

---

## 13. Security Model

### Authentication

- **JWT access tokens** — short-lived (default: 15 minutes). Sent as `Authorization: Bearer <token>`.
- **JWT refresh tokens** — longer-lived. Used to obtain new access tokens without re-login.
- Passwords are hashed with **bcrypt**.

### Device Authentication

- On enrollment, the server generates a random **API key** and returns it once to the agent.
- The agent stores it in its config file. The server stores a **bcrypt hash** of the key.
- Every WebSocket connection uses this key as `?token=<api_key>` in the URL.

### Enrollment Tokens

- One-time-use tokens stored in Redis with a TTL (default 60 minutes, configurable up to 72 hours).
- Consumed on first use — cannot be replayed.
- Rate-limited: 30 enrollment requests per minute.

### Transport Security

- Nginx terminates TLS. Agents can be configured to skip TLS certificate validation for self-signed certs (development only).
- WebSocket connections over `wss://` in production.

### Push Token Security

- Tokens are validated against regex patterns for Expo format (`ExponentPushToken[...]`) and raw token formats before storing.
- Platform field is restricted to `ios` or `android`.
- DELETE operations validate token format before accepting.

---

## 14. Infrastructure & Deployment

### 14.1 Docker Compose

**Production** (`docker-compose.yml`):

| Service | Image | Port | Role |
|---|---|---|---|
| `postgres` | `timescale/timescaledb:latest-pg16` | 5432 (internal) | Primary database |
| `redis` | `redis:7-alpine` | 6379 (internal) | Cache, broker, screenshots |
| `server` | Custom (Python/FastAPI) | 8000 (internal) | API + WebSocket |
| `worker` | Same as server | — | Celery worker |
| `beat` | Same as server | — | Celery Beat scheduler |
| `frontend` | Custom (Node build + nginx) | 3000 (internal) | Static files |
| `nginx` | `nginx:alpine` | 80, 443 | Reverse proxy + TLS |

**Development** (`docker-compose.dev.yml`) adds:
- pgAdmin on port 5050 (database browser)
- Redis Commander on port 8081 (Redis browser)

### 14.2 Nginx

Nginx handles all inbound traffic:

```
:80  → redirect to :443
:443 → TLS termination (self-signed or real cert)
  /api/v1/   → proxy to server:8000
  /ws/       → proxy to server:8000 (with Upgrade: websocket header)
  /          → serve React SPA (frontend:3000)
```

WebSocket support requires `proxy_http_version 1.1` and `Upgrade`/`Connection` headers — these are set in the nginx config.

### 14.3 Installation Scripts

#### `scripts/install-agent.sh` (Linux/macOS)

1. Detects OS and architecture.
2. Downloads the correct agent binary from the server.
3. Calls `POST /api/v1/enroll` with the provided token to get device credentials.
4. Creates the config file at `/etc/dtsys/agent.toml`.
5. Creates a `dtsys-agent` system user (unprivileged).
6. Sets up the service:
   - **Linux**: writes a systemd unit to `/etc/systemd/system/dtsys-agent.service`, enables and starts it.
   - **macOS**: writes a launchd plist to `/Library/LaunchDaemons/com.dtsys.agent.plist`, loads it with `launchctl`.

#### `scripts/install-agent.ps1` (Windows)

1. Requires Administrator privileges.
2. Downloads the Windows AMD64 agent binary.
3. Calls the enrollment endpoint.
4. Places config at `C:\Program Files\DTSYS\agent.toml`.
5. Registers a Windows Service using the Windows service API (via Go's service framework or WinSW).

#### MSI Installer (Windows, v1.3)

- Built with **WiX Toolset v4**.
- Source: `client/packaging/windows/dtsys-agent.wxs`
- Build script: `client/packaging/windows/build-msi.ps1`
- Supports silent install via Group Policy or Intune:
  ```
  msiexec /i DTSYSAgent.msi /quiet DTSYS_SERVER="https://dtsys.example.com" DTSYS_TOKEN="<token>"
  ```
- `MajorUpgrade` element handles in-place upgrades cleanly.
- Service lifecycle (install/start/stop/uninstall) via WinSW custom actions.

---

## 15. Agent Installation by Platform

### 15.1 Linux

**One-liner:**
```bash
curl -fsSL https://your-server/api/v1/installer/linux | \
  sudo bash -s -- --token YOUR_ENROLLMENT_TOKEN
```

**What gets installed:**
- Binary: `/usr/local/bin/dtsys-agent`
- Config: `/etc/dtsys/agent.toml`
- Service: `/etc/systemd/system/dtsys-agent.service`
- User: `dtsys-agent` (system, no shell, no home)

**Service management:**
```bash
sudo systemctl status dtsys-agent
sudo systemctl restart dtsys-agent
sudo journalctl -u dtsys-agent -f
```

**What the agent collects on Linux:**
- Software: `dpkg` (Debian/Ubuntu) or `rpm` (RHEL/CentOS/Fedora)
- Events: `journalctl`, `/var/log/syslog`
- Screenshot: requires X11 display + `scrot` or `xwd` + ImageMagick

### 15.2 macOS

**One-liner:**
```bash
curl -fsSL https://your-server/api/v1/installer/macos | \
  sudo bash -s -- --token YOUR_ENROLLMENT_TOKEN
```

**What gets installed:**
- Binary: `/usr/local/bin/dtsys-agent`
- Config: `/etc/dtsys/agent.toml`
- Service: `/Library/LaunchDaemons/com.dtsys.agent.plist` (starts at boot, runs as root)

**Service management:**
```bash
sudo launchctl list | grep dtsys
sudo launchctl unload /Library/LaunchDaemons/com.dtsys.agent.plist
sudo launchctl load /Library/LaunchDaemons/com.dtsys.agent.plist
```

**What the agent collects on macOS:**
- Software: `brew list --versions` + `system_profiler SPApplicationsDataType`
- Events: `/var/log/system.log`
- Screenshot: `screencapture -x -t jpg` — works even without GUI login

### 15.3 Windows

**Option A — PowerShell installer:**
```powershell
# Run as Administrator
irm https://your-server/api/v1/installer/windows | iex
# Then provide token when prompted, or:
.\install-agent.ps1 -Token "YOUR_TOKEN" -Server "https://your-server"
```

**Option B — MSI (Group Policy / Intune / SCCM):**
```
msiexec /i DTSYSAgent.msi /quiet ^
  DTSYS_SERVER="https://your-server" ^
  DTSYS_TOKEN="YOUR_TOKEN" ^
  DTSYS_ORG_ID="your-org-id"
```

**What gets installed:**
- Binary: `C:\Program Files\DTSYS\dtsys-agent.exe`
- Config: `C:\Program Files\DTSYS\agent.toml`
- Windows Service: `DTSYSAgent` (starts automatically, runs as LocalSystem)

**Service management:**
```powershell
Get-Service DTSYSAgent
Restart-Service DTSYSAgent
```

**What the agent collects on Windows:**
- Software: Registry query `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` — all programs visible in Add/Remove Programs
- Events: Windows Event Viewer — Application and System logs (errors and warnings)
- Screenshot: PowerShell GDI+ — works on any Windows desktop session (RDP included)
- Update check: WMI COM object

---

## 16. Development Environment

### Prerequisites

- Docker (for postgres + redis)
- Go 1.22+
- Node.js 20+
- Python 3.12

### One-Command Start

```bash
bash scripts/dev-start.sh
```

This script:
1. Checks all prerequisites.
2. Generates self-signed TLS certs.
3. Creates a `.env` file if missing.
4. Starts postgres and redis via Docker Compose.
5. Installs Python dependencies (`pip install -r requirements.txt`).
6. Installs Node dependencies (`npm install`).
7. Runs Alembic migrations.
8. Starts the FastAPI server with `--reload`.
9. Starts the React dev server.
10. Starts the Celery worker.
11. Builds and starts the agent (from `client/`).

After startup:
- Dashboard: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

Default credentials: `admin` / `admin123`

### Agent Config File (local dev)

```toml
[server]
url = "http://localhost:8000"
enrollment_token = "YOUR_TOKEN_HERE"
```

Generate a token:
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Create enrollment token
curl -s -X POST http://localhost:8000/api/v1/admin/enrollment-tokens \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"label":"dev","expires_in_hours":72}'
```

---

## 17. Release Pipeline (CI/CD)

GitHub Actions workflow (`.github/workflows/release.yml`) — 3-job pipeline triggered on `v*` tag push:

### Job 1: `build-binaries` (Ubuntu runner)

Builds 5 agent binaries using `GOOS`/`GOARCH` cross-compilation:

| Binary | GOOS | GOARCH |
|---|---|---|
| `dtsys-agent-linux-amd64` | linux | amd64 |
| `dtsys-agent-linux-arm64` | linux | arm64 |
| `dtsys-agent-darwin-amd64` | darwin | amd64 |
| `dtsys-agent-darwin-arm64` | darwin | arm64 |
| `dtsys-agent-windows-amd64.exe` | windows | amd64 |

Artifacts are uploaded to the workflow run.

### Job 2: `build-msi` (Windows runner)

1. Cross-compiles the Windows agent (same binary as above).
2. Downloads WiX Toolset v4 via `dotnet tool install --global wix`.
3. Runs `wix build dtsys-agent.wxs` to produce `DTSYSAgent.msi`.
4. Uploads MSI as an artifact.

### Job 3: `release` (Ubuntu runner)

1. Downloads all artifacts from Jobs 1 and 2.
2. Creates a GitHub Release for the tag.
3. Attaches all 5 binaries + MSI to the release.

---

## 18. Version History

### v1.3.0 — April 14, 2026

**Security**
- Push token endpoint hardened: Expo/raw format validation, per-user limit (10), platform field restricted to ios/android, DELETE input validation.
- Go toolchain upgraded from 1.25.0 → 1.25.9, resolving 17 stdlib vulnerabilities (govulncheck).
- Full security audit documented in `docs/security-audit-v1.3.md`.

**Features**
- **Mobile — Full command execution**: Commands tab with history, status polling, output modal, command library bottom sheet, one-tap dispatch of all command types.
- **Windows MSI installer**: WiX v4 source, `build-msi.ps1` build script, multi-job CI workflow, Group Policy / Intune deployment guide.
- **Device compliance policies**: `CompliancePolicy` + `ComplianceResult` models, 6 rule types, full REST API, Alembic migration, frontend Compliance page.
- **Audit log UI**: Paginated table with filters, CSV export, real-time SSE live mode. Admin-only.

**Infrastructure**
- Release CI updated to 3-job pipeline (binaries on Ubuntu, MSI on Windows, release on Ubuntu).

### v1.2.0 — April 14, 2026

Initial feature-complete release:
- Real-time monitoring (CPU, RAM, disk, network, temperature)
- Software inventory with update detection
- Remote command execution with live output
- Event log (syslog, journalctl, Event Viewer)
- Alert engine with auto-resolution
- Device screenshot capture (all platforms)
- NTP sync monitoring
- Process list
- Device grouping and tagging
- Scheduled commands
- Notification rules (browser push, email, webhook)
- Audit logging
- Dark/light theme
- Global search
- Network topology map
- Device comparison
- Software update management
- Single binary cross-platform agent
- Exponential backoff reconnection
- Priority-aware send buffer
- One-liner install scripts
- Docker Compose deployment (PostgreSQL + TimescaleDB, Redis, Nginx TLS)

---

*Document generated April 14, 2026 — DTSYS v1.3.0*
