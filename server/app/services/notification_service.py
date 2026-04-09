from __future__ import annotations

from app.models.alert import Alert
from app.models.device import Device
from app.models.notification_rule import NotificationRule
from app.services.event_stream import alert_event_stream
from app.tasks.notification_tasks import deliver_webhook_notification


SEVERITY_ORDER = {"info": 0, "warning": 1, "critical": 2}


class NotificationService:
    def __init__(self, db):
        self.db = db

    async def notify(self, alert: Alert, device: Device) -> None:
        from sqlalchemy import select

        result = await self.db.execute(
            select(NotificationRule).where(NotificationRule.is_enabled)
        )
        rules = result.scalars().all()
        matching_rules = [
            rule
            for rule in rules
            if self._matches(rule, alert)
        ]

        payload = {
            "id": str(alert.id),
            "device_id": str(alert.device_id),
            "device_hostname": device.label or device.hostname,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "message": alert.message,
            "is_resolved": alert.is_resolved,
            "created_at": alert.created_at.isoformat(),
            "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
        }

        browser_sent = False
        for rule in matching_rules:
            if rule.channel == "browser" and not browser_sent:
                await alert_event_stream.publish(payload)
                browser_sent = True
            if rule.channel == "webhook" and rule.webhook_url:
                deliver_webhook_notification.delay(rule.webhook_url, payload)

        if not browser_sent:
            await alert_event_stream.publish(payload)

    def _matches(self, rule: NotificationRule, alert: Alert) -> bool:
        if rule.alert_type not in {"*", alert.alert_type}:
            return False
        return SEVERITY_ORDER.get(alert.severity, 0) >= SEVERITY_ORDER.get(rule.severity_min, 0)
