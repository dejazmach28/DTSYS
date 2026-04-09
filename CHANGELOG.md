# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-09
### Added
- Multi-platform DTSYS device agent for Linux, Windows, and macOS.
- Secure device enrollment with single-use Redis-backed enrollment tokens.
- Device registration, API key provisioning, device revoke flow, and key transport over WebSocket.
- Background telemetry collection for CPU, RAM, disk usage, temperature, uptime, disk I/O, and network throughput.
- Software inventory collection across Linux, Windows, and macOS agents.
- System event collection from journald, dmesg, syslog, macOS DiagnosticReports, and Windows Event Viewer.
- Network interface reporting with MAC, IPv4, IPv6, MTU, and interface status.
- NTP drift collection and remote forced time synchronization.
- Remote command execution for shell, reboot, update checks, screenshots, process list refresh, sync time, and diagnostics.
- Agent auto-update check endpoint and client updater flow.
- Runtime agent config push with live loop interval reconfiguration and config persistence.
- Process list collection and storage for top CPU-consuming processes.
- Screenshot capture support across Windows, Linux, and macOS devices.
- Agent-side warning and error log forwarding into the server event stream.
- FastAPI backend with JWT auth, refresh tokens, admin/user roles, audit logging, and optional LDAP authentication.
- REST APIs for devices, metrics, alerts, software, commands, bulk commands, groups, tags, scheduled commands, notification rules, downloads, status, and admin operations.
- Redis-backed rate limiting for login, device registration, SSE sessions, and WebSocket connection attempts.
- Server-Sent Events for real-time alert and activity delivery to the frontend.
- Alert engine for offline, crash, high CPU, high RAM, full disk, high temperature, and time drift conditions.
- Notification system with browser, webhook, and email delivery channels.
- Scheduled command execution using Celery beat and cron expressions.
- Storage cleanup tasks and retention policy configuration for metrics, events, commands, and alerts.
- Device network persistence and network endpoint support.
- Live connection tracking with admin disconnect controls.
- Public health and status endpoints with DB, Redis, online device, and alert visibility.
- React frontend dashboard with live activity, device filtering, bulk actions, sparklines, charts, and export tools.
- Device detail experience with overview, metrics, software, events, agent logs, commands, network, processes, screenshots, config, groups, and tags.
- First-run onboarding wizard for initial enrollment.
- Device comparison view and network topology map.
- Alerts page summaries, grouped resolution actions, and export support.
- Reports page with alert summaries, uptime rollups, software update analysis, and data export.
- Software updates management page with aggregation, bulk dispatch, search, and severity cues.
- Scheduled commands UI and notification rules UI.
- Global search, keyboard shortcuts, responsive mobile layout, dark/light theme support, and live SSE badge updates.
- Windows packaging assets including service install, uninstall, NSSM fallback, and WinSW config.
- Developer tooling with Makefile targets, Alembic migrations, Docker Compose development dependencies, test suites, and cross-platform agent builds.
