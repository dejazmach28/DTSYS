import uuid
from typing import Annotated
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.user import User
from app.models.metrics import DeviceMetric
from app.dependencies import get_current_user

router = APIRouter(prefix="/devices/{device_id}/metrics", tags=["metrics"])


@router.get("")
async def get_metrics(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    hours: int = Query(24, ge=1, le=720),
    limit: int = Query(500, ge=1, le=5000),
):
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(DeviceMetric)
        .where(DeviceMetric.device_id == device_id, DeviceMetric.time >= since)
        .order_by(DeviceMetric.time.desc())
        .limit(limit)
    )
    metrics = result.scalars().all()
    return [
        {
            "time": m.time.isoformat(),
            "cpu_percent": m.cpu_percent,
            "ram_percent": m.ram_percent,
            "disk_percent": m.disk_percent,
            "cpu_temp": m.cpu_temp,
            "uptime_secs": m.uptime_secs,
            "ram_total_mb": m.ram_total_mb,
            "ram_used_mb": m.ram_used_mb,
            "disk_total_gb": m.disk_total_gb,
            "disk_used_gb": m.disk_used_gb,
        }
        for m in metrics
    ]


@router.get("/latest")
async def get_latest_metric(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(DeviceMetric)
        .where(DeviceMetric.device_id == device_id)
        .order_by(DeviceMetric.time.desc())
        .limit(1)
    )
    m = result.scalar_one_or_none()
    if not m:
        return None
    return {
        "time": m.time.isoformat(),
        "cpu_percent": m.cpu_percent,
        "ram_percent": m.ram_percent,
        "disk_percent": m.disk_percent,
        "cpu_temp": m.cpu_temp,
        "uptime_secs": m.uptime_secs,
    }
