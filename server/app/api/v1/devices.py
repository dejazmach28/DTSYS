import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.redis import get_redis
from app.db.session import get_db
from app.models.network import DeviceNetworkInfo
from app.models.user import User
from app.dependencies import get_current_user, require_admin
from app.services.device_service import DeviceService
from app.websocket.manager import manager

router = APIRouter(prefix="/devices", tags=["devices"])


class RegisterRequest(BaseModel):
    hostname: str
    os_type: str
    os_version: str | None = None
    arch: str | None = None
    fingerprint: str
    ip_address: str | None = None
    enrollment_token: str


@router.post("/register")
async def register_device(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
):
    token_key = f"enrollment:{body.enrollment_token}"
    if await redis.get(token_key) is None:
        raise HTTPException(status_code=400, detail="Invalid or expired enrollment token")

    service = DeviceService(db)
    device, raw_key = await service.register_device(
        hostname=body.hostname,
        os_type=body.os_type,
        os_version=body.os_version,
        arch=body.arch,
        fingerprint=body.fingerprint,
        ip_address=body.ip_address,
    )
    await db.commit()
    await redis.delete(token_key)
    return {
        "device_id": str(device.id),
        "api_key": raw_key,
        "message": "Device registered successfully",
    }


@router.get("")
async def list_devices(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    service = DeviceService(db)
    devices = await service.list_devices(skip=skip, limit=limit)
    return [
        {
            "id": str(d.id),
            "hostname": d.hostname,
            "os_type": d.os_type,
            "os_version": d.os_version,
            "arch": d.arch,
            "ip_address": d.ip_address,
            "status": d.status,
            "last_seen": d.last_seen.isoformat() if d.last_seen else None,
            "enrolled_at": d.enrolled_at.isoformat(),
            "label": d.label,
            "is_online": manager.is_connected(d.id),
        }
        for d in devices
    ]


@router.get("/{device_id}")
async def get_device(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = DeviceService(db)
    d = await service.get_device(device_id)
    return {
        "id": str(d.id),
        "hostname": d.hostname,
        "os_type": d.os_type,
        "os_version": d.os_version,
        "arch": d.arch,
        "ip_address": d.ip_address,
        "status": d.status,
        "last_seen": d.last_seen.isoformat() if d.last_seen else None,
        "enrolled_at": d.enrolled_at.isoformat(),
        "label": d.label,
        "notes": d.notes,
        "is_online": manager.is_connected(d.id),
    }


@router.get("/{device_id}/network")
async def get_device_network(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = DeviceService(db)
    await service.get_device(device_id)

    result = await db.execute(
        select(DeviceNetworkInfo)
        .where(DeviceNetworkInfo.device_id == device_id)
        .order_by(DeviceNetworkInfo.interface_name.asc())
    )
    interfaces = result.scalars().all()
    return {
        "interfaces": [
            {
                "id": str(interface.id),
                "interface_name": interface.interface_name,
                "mac_address": interface.mac_address,
                "ipv4": interface.ipv4,
                "ipv6": interface.ipv6,
                "is_up": interface.is_up,
                "mtu": interface.mtu,
                "updated_at": interface.updated_at.isoformat() if interface.updated_at else None,
            }
            for interface in interfaces
        ]
    }


@router.patch("/{device_id}")
async def update_device(
    device_id: uuid.UUID,
    body: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = DeviceService(db)
    device = await service.get_device(device_id)
    if "label" in body:
        device.label = body["label"]
    if "notes" in body:
        device.notes = body["notes"]
    await db.commit()
    return {"message": "Updated"}


@router.delete("/{device_id}")
async def revoke_device(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = DeviceService(db)
    await service.revoke_device(device_id)
    await db.commit()
    return {"message": "Device revoked"}
