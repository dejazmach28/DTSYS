"""Inventory and asset tracking endpoints."""

import csv
import io
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.device import Device
from app.models.user import User

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("")
async def list_inventory(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    location: str | None = Query(None),
    assigned_to: str | None = Query(None),
    warranty_expiring_days: int | None = Query(None, ge=1, le=3650),
):
    query = select(Device).where(~Device.is_revoked).order_by(Device.hostname.asc())
    if location:
        query = query.where(Device.location == location)
    if assigned_to:
        query = query.where(Device.assigned_to.ilike(f"%{assigned_to}%"))
    if warranty_expiring_days is not None:
        query = query.where(
            Device.warranty_expires.is_not(None),
            Device.warranty_expires <= date.today() + timedelta(days=warranty_expiring_days),
        )
    result = await db.execute(query)
    return [_serialize_inventory_device(device) for device in result.scalars().all()]


@router.get("/export.csv")
async def export_inventory_csv(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Device).where(~Device.is_revoked).order_by(Device.hostname.asc()))
    devices = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "hostname",
            "label",
            "os",
            "ip",
            "serial",
            "manufacturer",
            "model",
            "purchase_date",
            "warranty_expires",
            "location",
            "assigned_to",
            "asset_tag",
            "status",
        ]
    )
    for device in devices:
        writer.writerow(
            [
                device.hostname,
                device.label or "",
                device.os_version or device.os_type,
                device.ip_address or "",
                device.serial_number or "",
                device.manufacturer or "",
                device.model_name or "",
                device.purchase_date.isoformat() if device.purchase_date else "",
                device.warranty_expires.isoformat() if device.warranty_expires else "",
                device.location or "",
                device.assigned_to or "",
                device.asset_tag or "",
                device.status,
            ]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="dtsys-inventory.csv"'},
    )


def _serialize_inventory_device(device: Device) -> dict:
    return {
        "id": str(device.id),
        "hostname": device.hostname,
        "label": device.label,
        "os_type": device.os_type,
        "os_version": device.os_version,
        "ip_address": device.ip_address,
        "serial_number": device.serial_number,
        "manufacturer": device.manufacturer,
        "model_name": device.model_name,
        "purchase_date": device.purchase_date.isoformat() if device.purchase_date else None,
        "warranty_expires": device.warranty_expires.isoformat() if device.warranty_expires else None,
        "location": device.location,
        "assigned_to": device.assigned_to,
        "asset_tag": device.asset_tag,
        "status": device.status,
    }
