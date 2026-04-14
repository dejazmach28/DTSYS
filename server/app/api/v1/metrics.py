import uuid
from typing import Annotated
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.user import User
from app.models.metrics import DeviceMetric
from app.models.device import Device
from app.dependencies import get_current_user, get_current_org_id

router = APIRouter(prefix="/devices/{device_id}/metrics", tags=["metrics"])


@router.get("")
async def get_metrics(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    current_org_id: Annotated[uuid.UUID, Depends(get_current_org_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    hours: int = Query(24, ge=1, le=720),
    limit: int = Query(500, ge=1, le=5000),
):
    await _get_device_for_org(db, device_id, current_org_id)
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
            "disk_read_mbps": m.disk_read_mbps,
            "disk_write_mbps": m.disk_write_mbps,
            "net_sent_mbps": m.net_sent_mbps,
            "net_recv_mbps": m.net_recv_mbps,
        }
        for m in metrics
    ]


@router.get("/latest")
async def get_latest_metric(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    current_org_id: Annotated[uuid.UUID, Depends(get_current_org_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_device_for_org(db, device_id, current_org_id)
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
        "disk_read_mbps": m.disk_read_mbps,
        "disk_write_mbps": m.disk_write_mbps,
        "net_sent_mbps": m.net_sent_mbps,
        "net_recv_mbps": m.net_recv_mbps,
    }


async def _get_device_for_org(db: AsyncSession, device_id: uuid.UUID, org_id: uuid.UUID) -> Device:
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.org_id == org_id, ~Device.is_revoked)
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device
