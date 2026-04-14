import uuid
import ipaddress
import json
from datetime import datetime, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.device import Device
from app.models.command import Command
from app.models.metrics import DeviceMetric
from app.models.network import DeviceNetworkInfo
from app.models.software import SoftwareInventory
from app.models.ssh_key import SSHKey
from app.models.event import Event
from app.websocket.messages import ClientMessageType
from app.core.logging import get_logger
from app.services.alert_service import AlertService
from app.services.activity_stream import activity_event_stream

log = get_logger(__name__)
MAX_EVENT_MESSAGE_LEN = 2048
MAX_EVENT_SOURCE_LEN = 256
MAX_RAW_DATA_BYTES = 4096
MAX_SCREENSHOT_B64 = 2_000_000
MAX_PROCESS_COUNT = 50


class MessageHandler:
    """Processes incoming WebSocket messages from device agents."""

    def __init__(self, db: AsyncSession, redis=None):
        self.db = db
        self.redis = redis
        self.alert_service = AlertService(db)

    async def handle(self, device: Device, message: dict) -> dict | None:
        msg_type = message.get("type")
        payload = message.get("data", {})
        log.debug("ws_message", device_id=str(device.id), type=msg_type)

        match msg_type:
            case ClientMessageType.TELEMETRY:
                return await self._handle_telemetry(device, payload)
            case ClientMessageType.SOFTWARE_INVENTORY:
                return await self._handle_software(device, payload)
            case ClientMessageType.EVENT_REPORT:
                return await self._handle_event(device, payload)
            case ClientMessageType.NTP_STATUS:
                return await self._handle_ntp(device, payload)
            case ClientMessageType.NETWORK_INFO:
                return await self._handle_network_info(device, payload)
            case ClientMessageType.SSH_KEYS:
                return await self._handle_ssh_keys(device, payload)
            case ClientMessageType.PROCESS_LIST:
                return await self._handle_process_list(device, payload)
            case ClientMessageType.AGENT_INFO:
                return await self._handle_agent_info(device, payload)
            case ClientMessageType.COMMAND_OUTPUT:
                return await self._handle_command_output(device, payload)
            case ClientMessageType.COMMAND_RESULT:
                return await self._handle_command_result(device, payload)
            case ClientMessageType.SCREENSHOT_RESULT:
                return await self._handle_screenshot_result(device, payload)
            case "pong":
                return None
            case _:
                log.warning("unknown_message_type", type=msg_type, device_id=str(device.id))
                return None

    async def _handle_telemetry(self, device: Device, data: dict) -> None:
        metric = DeviceMetric(
            device_id=device.id,
            cpu_percent=data.get("cpu_percent"),
            ram_percent=data.get("ram_percent"),
            disk_percent=data.get("disk_percent"),
            cpu_temp=data.get("cpu_temp"),
            uptime_secs=data.get("uptime_secs"),
            ram_total_mb=data.get("ram_total_mb"),
            ram_used_mb=data.get("ram_used_mb"),
            disk_total_gb=data.get("disk_total_gb"),
            disk_used_gb=data.get("disk_used_gb"),
            disk_read_mbps=data.get("disk_read_mbps"),
            disk_write_mbps=data.get("disk_write_mbps"),
            net_sent_mbps=data.get("net_sent_mbps"),
            net_recv_mbps=data.get("net_recv_mbps"),
        )
        self.db.add(metric)

        # Update device last_seen
        device.last_seen = datetime.now(timezone.utc)
        device.status = "online"

        await self.db.flush()
        await self.alert_service.evaluate_metrics(device, metric)
        await auto_resolve_alerts(self.db, device.id, data)

    async def _handle_software(self, device: Device, data: dict) -> None:
        # Full replace: delete existing, insert new batch
        await self.db.execute(
            delete(SoftwareInventory).where(SoftwareInventory.device_id == device.id)
        )
        packages = data.get("packages", [])
        for pkg in packages:
            sw = SoftwareInventory(
                device_id=device.id,
                name=pkg.get("name", ""),
                version=pkg.get("version"),
                update_available=pkg.get("update_available", False),
                latest_version=pkg.get("latest_version"),
            )
            self.db.add(sw)

    async def _handle_event(self, device: Device, data: dict) -> None:
        if self.redis is not None:
            key = f"event_rate:{device.id}"
            count = await self.redis.incr(key)
            if count == 1:
                await self.redis.expire(key, 30)
            if count > 100:
                log.warning("event_rate_limited", device_id=str(device.id), count=count)
                return
        message = _truncate(data.get("message", ""), MAX_EVENT_MESSAGE_LEN)
        source = _truncate(data.get("source", ""), MAX_EVENT_SOURCE_LEN)
        raw_data = data.get("raw_data")
        if raw_data is not None:
            try:
                if len(json.dumps(raw_data)) > MAX_RAW_DATA_BYTES:
                    raw_data = {"truncated": True}
            except (TypeError, ValueError):
                raw_data = {"truncated": True}
        event = Event(
            device_id=device.id,
            event_type=data.get("event_type", "info"),
            source=source or None,
            message=message,
            raw_data=raw_data,
        )
        self.db.add(event)
        await self.db.flush()
        await activity_event_stream.publish(
            {
                "device_id": str(device.id),
                "device_hostname": device.label or device.hostname,
                "org_id": str(device.org_id) if device.org_id else None,
                "event_type": event.event_type,
                "message": event.message,
                "source": event.source,
                "time": datetime.now(timezone.utc).isoformat(),
            }
        )

        if data.get("event_type") == "crash":
            await self.alert_service.create_alert(
                device=device,
                alert_type="crash",
                severity="critical",
                message=f"Crash detected: {message}",
            )

    async def _handle_ntp(self, device: Device, data: dict) -> None:
        from app.config import get_settings
        settings = get_settings()
        offset_ms = abs(data.get("estimated_offset_ms", data.get("offset_ms", 0)))
        if offset_ms > settings.ALERT_NTP_OFFSET_MS:
            await self.alert_service.create_alert(
                device=device,
                alert_type="time_drift",
                severity="warning",
                message=f"NTP offset is {offset_ms:.1f}ms (threshold: {settings.ALERT_NTP_OFFSET_MS}ms)",
            )
        clock_usable = data.get("clock_usable", True)
        if not clock_usable:
            await self.alert_service.create_alert(
                device=device,
                alert_type="clock_skew",
                severity="warning",
                message=f"System clock is off by ~{offset_ms/1000:.0f}s — run Sync Time to fix",
            )
        else:
            await self.db.execute(
                update(Alert)
                .where(
                    Alert.device_id == device.id,
                    Alert.alert_type == "clock_skew",
                    ~Alert.is_resolved,
                )
                .values(is_resolved=True, resolved_at=datetime.now(timezone.utc))
            )

    async def _handle_command_output(self, device: Device, data: dict) -> None:
        # Streaming output - update command record
        cmd_id = data.get("command_id")
        if cmd_id:
            await self.db.execute(
                update(Command)
                .where(Command.id == uuid.UUID(cmd_id))
                .values(status="running", output=data.get("output", ""))
            )

    async def _handle_command_result(self, device: Device, data: dict) -> None:
        cmd_id = data.get("command_id")
        if not cmd_id:
            return

        command = await self.db.get(Command, uuid.UUID(cmd_id))
        if not command:
            return

        exit_code = data.get("exit_code", 1)
        await self.db.execute(
            update(Command)
            .where(Command.id == command.id)
            .values(
                status="completed" if exit_code == 0 else "failed",
                exit_code=exit_code,
                output=data.get("output", ""),
                completed_at=datetime.now(timezone.utc),
            )
        )
        log.info("command_result", device_id=str(device.id), command_id=cmd_id, exit_code=exit_code)

        if command.command_type == "sync_time" and exit_code == 0:
            result = await self.db.execute(
                select(Alert).where(
                    Alert.device_id == device.id,
                    Alert.alert_type == "time_drift",
                    ~Alert.is_resolved,
                )
            )
            for alert in result.scalars().all():
                alert.is_resolved = True
                alert.resolved_at = datetime.now(timezone.utc)

    async def _handle_network_info(self, device: Device, data: dict) -> None:
        interfaces = data.get("interfaces", [])
        await self.db.execute(
            delete(DeviceNetworkInfo).where(DeviceNetworkInfo.device_id == device.id)
        )

        device.last_seen = datetime.now(timezone.utc)
        device.status = "online"

        preferred_ip = None
        fallback_ip = None
        for iface in interfaces:
            ipv4_list = iface.get("ipv4", []) or []
            ipv6_list = iface.get("ipv6", []) or []
            self.db.add(
                DeviceNetworkInfo(
                    device_id=device.id,
                    interface_name=iface.get("name", ""),
                    mac_address=iface.get("mac_address"),
                    ipv4=ipv4_list,
                    ipv6=ipv6_list,
                    is_up=iface.get("is_up", False),
                    mtu=iface.get("mtu"),
                )
            )

            for raw_ip in ipv4_list:
                ip_value = _extract_ip(raw_ip)
                if not ip_value:
                    continue
                if fallback_ip is None:
                    fallback_ip = ip_value
                if preferred_ip is None and not ip_value.is_private:
                    preferred_ip = ip_value

        selected_ip = preferred_ip or fallback_ip
        device.ip_address = str(selected_ip) if selected_ip else device.ip_address

    async def _handle_screenshot_result(self, device: Device, data: dict) -> None:
        if self.redis is None:
            return
        image_b64 = data.get("image_b64")
        if image_b64 and len(image_b64) > MAX_SCREENSHOT_B64:
            log.warning("screenshot_too_large", device_id=str(device.id), size=len(image_b64))
            return
        payload = {
            "image_b64": image_b64,
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "width": data.get("width"),
            "height": data.get("height"),
            "error": data.get("error"),
        }
        await self.redis.setex(f"screenshot:{device.id}", 300, json.dumps(payload))

    async def _handle_process_list(self, device: Device, data: dict) -> None:
        if self.redis is None:
            return
        processes = data.get("processes", [])
        if isinstance(processes, list) and len(processes) > MAX_PROCESS_COUNT:
            processes = processes[:MAX_PROCESS_COUNT]
        payload = {
            "processes": processes,
            "captured_at": datetime.now(timezone.utc).isoformat(),
        }
        await self.redis.setex(f"process_list:{device.id}", 600, json.dumps(payload))

    async def _handle_agent_info(self, device: Device, data: dict) -> None:
        version = data.get("version")
        if version:
            device.agent_version = str(version)[:50]
        device.last_seen = datetime.now(timezone.utc)
        device.status = "online"

    async def _handle_ssh_keys(self, device: Device, data: dict) -> None:
        await self.db.execute(delete(SSHKey).where(SSHKey.device_id == device.id))
        for key in data.get("keys", []):
            self.db.add(
                SSHKey(
                    device_id=device.id,
                    key_type=key.get("type", ""),
                    public_key=key.get("public_key", ""),
                    fingerprint=key.get("fingerprint", ""),
                    comment=key.get("comment"),
                )
            )


def _extract_ip(value: str) -> ipaddress.IPv4Address | None:
    try:
        ip = ipaddress.ip_interface(value).ip
    except ValueError:
        try:
            ip = ipaddress.ip_address(value)
        except ValueError:
            return None
    if isinstance(ip, ipaddress.IPv4Address):
        return ip
    return None


def _truncate(value: str | None, limit: int) -> str:
    if not value:
        return ""
    value = str(value)
    if len(value) <= limit:
        return value
    return value[:limit]


async def auto_resolve_alerts(db: AsyncSession, device_id: uuid.UUID, telemetry: dict) -> None:
    now = datetime.now(timezone.utc)
    cpu = telemetry.get("cpu_percent")
    if cpu is not None and cpu < 80.0:
        await db.execute(
            update(Alert)
            .where(
                Alert.device_id == device_id,
                Alert.alert_type == "high_cpu",
                ~Alert.is_resolved,
            )
            .values(is_resolved=True, resolved_at=now)
        )
    ram = telemetry.get("ram_percent")
    if ram is not None and ram < 85.0:
        await db.execute(
            update(Alert)
            .where(
                Alert.device_id == device_id,
                Alert.alert_type == "high_ram",
                ~Alert.is_resolved,
            )
            .values(is_resolved=True, resolved_at=now)
        )
    disk = telemetry.get("disk_percent")
    if disk is not None and disk < 90.0:
        await db.execute(
            update(Alert)
            .where(
                Alert.device_id == device_id,
                Alert.alert_type == "high_disk",
                ~Alert.is_resolved,
            )
            .values(is_resolved=True, resolved_at=now)
        )
