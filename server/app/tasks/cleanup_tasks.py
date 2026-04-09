from datetime import datetime, timedelta, timezone
import asyncio

from app.tasks.celery_app import celery_app
from app.core.logging import get_logger

log = get_logger(__name__)


@celery_app.task(name="app.tasks.cleanup_tasks.cleanup_old_metrics")
def cleanup_old_metrics(retain_days: int = 90):
    """Delete metrics older than retain_days to keep DB size manageable."""
    asyncio.run(_cleanup_async(retain_days))


async def _cleanup_async(retain_days: int):
    from sqlalchemy import delete
    from app.db.session import AsyncSessionLocal
    from app.models.metrics import DeviceMetric
    from app.models.event import Event

    cutoff = datetime.now(timezone.utc) - timedelta(days=retain_days)

    async with AsyncSessionLocal() as db:
        result = await db.execute(delete(DeviceMetric).where(DeviceMetric.time < cutoff))
        metrics_deleted = result.rowcount

        # Keep events for longer (1 year)
        event_cutoff = datetime.now(timezone.utc) - timedelta(days=365)
        result = await db.execute(delete(Event).where(Event.time < event_cutoff))
        events_deleted = result.rowcount

        await db.commit()
        log.info("cleanup_complete", metrics_deleted=metrics_deleted, events_deleted=events_deleted)
