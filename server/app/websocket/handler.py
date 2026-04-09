import uuid
import ipaddress
from datetime import datetime, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.device import Device
from app.models.command import Command
from app.models.metrics import DeviceMetric
from app.models.network import DeviceNetworkInfo
from app.models.software import SoftwareInventory
from app.models.event import Event
from app.websocket.messages import ClientMessageType
from app.core.logging import get_logger
from app.services.alert_service import AlertService

log = get_logger(__name__)


class MessageHandler:
    """Processes incoming WebSocket messages from device agents."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.alert_service = AlertService(db)

    async def handle(self, device: Device, message: dict) -> dict | None:
        msg_type = message.get("type")
        payload = message.get("data", {})

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
            case ClientMessageType.COMMAND_OUTPUT:
                return await self._handle_command_output(device, payload)
            case ClientMessageType.COMMAND_RESULT:
                return await self._handle_command_result(device, payload)
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
        )
        self.db.add(metric)

        # Update device last_seen
        device.last_seen = datetime.now(timezone.utc)
        device.status = "online"

        await self.db.flush()
        await self.alert_service.evaluate_metrics(device, metric)

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
        event = Event(
            device_id=device.id,
            event_type=data.get("event_type", "info"),
            source=data.get("source"),
            message=data.get("message", ""),
            raw_data=data.get("raw_data"),
        )
        self.db.add(event)

        if data.get("event_type") == "crash":
            await self.alert_service.create_alert(
                device=device,
                alert_type="crash",
                severity="critical",
                message=f"Crash detected: {data.get('message', '')}",
            )

    async def _handle_ntp(self, device: Device, data: dict) -> None:
        from app.config import get_settings
        settings = get_settings()
        offset_ms = abs(data.get("offset_ms", 0))
        if offset_ms > settings.ALERT_NTP_OFFSET_MS:
            await self.alert_service.create_alert(
                device=device,
                alert_type="time_drift",
                severity="warning",
                message=f"NTP offset is {offset_ms:.1f}ms (threshold: {settings.ALERT_NTP_OFFSET_MS}ms)",
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
