import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.alert import Alert
from app.models.device import Device
from app.models.metrics import DeviceMetric
from app.config import get_settings
from app.core.logging import get_logger
from app.services.notification_service import NotificationService

log = get_logger(__name__)
settings = get_settings()


class AlertService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notification_service = NotificationService(db)

    async def create_alert(
        self,
        device: Device,
        alert_type: str,
        severity: str,
        message: str,
    ) -> Alert:
        # Check if an identical unresolved alert already exists
        result = await self.db.execute(
            select(Alert).where(
                Alert.device_id == device.id,
                Alert.alert_type == alert_type,
                ~Alert.is_resolved,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

        alert = Alert(
            device_id=device.id,
            alert_type=alert_type,
            severity=severity,
            message=message,
        )
        self.db.add(alert)
        device.status = "alert"
        await self.db.flush()
        await self.notification_service.notify(alert, device)
        log.info("alert_created", device_id=str(device.id), type=alert_type, severity=severity)
        return alert

    async def evaluate_metrics(self, device: Device, metric: DeviceMetric) -> None:
        checks = [
            (
                metric.cpu_percent is not None and metric.cpu_percent > settings.ALERT_CPU_PERCENT,
                "high_cpu",
                "warning",
                f"CPU usage {metric.cpu_percent:.1f}% exceeds threshold {settings.ALERT_CPU_PERCENT}%",
            ),
            (
                metric.ram_percent is not None and metric.ram_percent > settings.ALERT_RAM_PERCENT,
                "high_ram",
                "warning",
                f"RAM usage {metric.ram_percent:.1f}% exceeds threshold {settings.ALERT_RAM_PERCENT}%",
            ),
            (
                metric.disk_percent is not None and metric.disk_percent > settings.ALERT_DISK_PERCENT,
                "disk_full",
                "critical",
                f"Disk usage {metric.disk_percent:.1f}% exceeds threshold {settings.ALERT_DISK_PERCENT}%",
            ),
            (
                metric.cpu_temp is not None and metric.cpu_temp > settings.ALERT_CPU_TEMP_CELSIUS,
                "high_temp",
                "warning",
                f"CPU temperature {metric.cpu_temp:.1f}°C exceeds threshold {settings.ALERT_CPU_TEMP_CELSIUS}°C",
            ),
        ]
        for triggered, alert_type, severity, message in checks:
            if triggered:
                await self.create_alert(device, alert_type, severity, message)

    async def resolve_alert(self, alert_id: uuid.UUID) -> Alert | None:
        from datetime import datetime, timezone
        result = await self.db.execute(select(Alert).where(Alert.id == alert_id))
        alert = result.scalar_one_or_none()
        if alert:
            alert.is_resolved = True
            alert.resolved_at = datetime.now(timezone.utc)
        return alert
