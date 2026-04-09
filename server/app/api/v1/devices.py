import json
import re
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field, field_validator
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.redis import check_rate_limit, get_redis
from app.core.security import generate_api_key, hash_api_key
from app.db.session import get_db
from app.models.device import Device
from app.models.device_config import DeviceConfig
from app.models.event import Event
from app.models.network import DeviceNetworkInfo
from app.models.user import User
from app.dependencies import get_current_user, require_admin
from app.services.audit_service import log_action
from app.services.device_service import DeviceService
from app.websocket.manager import manager
from app.websocket.messages import ServerMessageType

router = APIRouter(prefix="/devices", tags=["devices"])
TAG_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,50}$")


class RegisterRequest(BaseModel):
    hostname: str
    os_type: str
    os_version: str | None = None
    arch: str | None = None
    fingerprint: str
    ip_address: str | None = None
    enrollment_token: str


class UpdateDeviceRequest(BaseModel):
    label: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=5000)
    tags: list[str] | None = None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, tags: list[str] | None) -> list[str] | None:
        if tags is None:
            return tags
        for tag in tags:
            if not TAG_PATTERN.fullmatch(tag):
                raise ValueError("tags must be alphanumeric and may include dash or underscore, up to 50 characters")
        return tags


class DeviceConfigRequest(BaseModel):
    telemetry_interval_secs: int
    software_scan_interval_m: int
    event_poll_interval_secs: int


@router.post("/register")
async def register_device(
    body: RegisterRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
):
    client_ip = _get_client_ip(request)
    if not await check_rate_limit(redis, f"rate_limit:register:{client_ip}", limit=5, window_secs=3600):
        raise HTTPException(status_code=429, detail="Too many registration attempts")

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
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    tag: str | None = Query(None),
    search: str | None = Query(None),
):
    service = DeviceService(db)
    total = await service.count_devices(tag=tag, search=search)
    response.headers["X-Total-Count"] = str(total)
    devices = await service.list_devices(skip=skip, limit=limit, tag=tag, search=search)
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
            "notes": d.notes,
            "tags": d.tags or [],
            "is_online": manager.is_connected(d.id),
        }
        for d in devices
    ]


@router.get("/by-fingerprint/{fingerprint}")
async def get_device_by_fingerprint(
    fingerprint: str,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Device).where(Device.fingerprint == fingerprint, ~Device.is_revoked)
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return {
        "id": str(device.id),
        "hostname": device.hostname,
        "label": device.label,
        "fingerprint": device.fingerprint,
        "status": device.status,
    }


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
        "tags": d.tags or [],
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
    body: UpdateDeviceRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = DeviceService(db)
    device = await service.get_device(device_id)
    if body.label is not None:
        device.label = body.label
    if body.notes is not None:
        device.notes = body.notes
    if body.tags is not None:
        device.tags = sorted(set(tag.strip() for tag in body.tags if tag.strip()))
    await db.commit()
    return {"message": "Updated"}


@router.get("/{device_id}/config")
async def get_device_config(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = DeviceService(db)
    await service.get_device(device_id)
    config_row = await db.get(DeviceConfig, device_id)
    config_data = config_row.config if config_row else _default_device_config()
    return {
        "device_id": str(device_id),
        "config": config_data,
        "updated_at": config_row.updated_at.isoformat() if config_row else None,
    }


@router.post("/{device_id}/config")
async def update_device_config(
    device_id: uuid.UUID,
    body: DeviceConfigRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = DeviceService(db)
    await service.get_device(device_id)

    payload = body.model_dump()
    config_row = await db.get(DeviceConfig, device_id)
    if config_row is None:
        config_row = DeviceConfig(device_id=device_id, config=payload)
        db.add(config_row)
    else:
        config_row.config = payload

    await db.commit()

    sent = False
    if manager.is_connected(device_id):
        sent = await manager.send_to_device(
            device_id,
            {"type": ServerMessageType.CONFIG_UPDATE, "data": payload},
        )

    return {
        "device_id": str(device_id),
        "config": payload,
        "sent": sent,
    }


@router.delete("/{device_id}")
async def revoke_device(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = DeviceService(db)
    await service.revoke_device(device_id)
    await log_action(
        db,
        current_user,
        "device_revoked",
        resource_type="device",
        resource_id=str(device_id),
    )
    await db.commit()
    return {"message": "Device revoked"}


@router.post("/{device_id}/rotate-key")
async def rotate_device_key(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = DeviceService(db)
    device = await service.get_device(device_id)
    raw_key = generate_api_key()
    device.api_key_hash = hash_api_key(raw_key)
    await log_action(
        db,
        current_user,
        "device_key_rotated",
        resource_type="device",
        resource_id=str(device_id),
    )
    await db.commit()
    return {"device_id": str(device_id), "api_key": raw_key}


@router.post("/{device_id}/screenshot/request")
async def request_screenshot(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = DeviceService(db)
    await service.get_device(device_id)
    if not manager.is_connected(device_id):
        raise HTTPException(status_code=409, detail="Device is offline")

    await manager.send_to_device(
        device_id,
        {
            "type": ServerMessageType.SCREENSHOT_REQUEST,
            "data": {"command_id": str(uuid.uuid4())},
        },
    )
    return {"message": "Screenshot requested"}


@router.get("/{device_id}/screenshot")
async def get_screenshot(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    redis: Annotated[Redis, Depends(get_redis)],
):
    payload = await redis.get(f"screenshot:{device_id}")
    if payload is None:
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return json.loads(payload)


@router.get("/{device_id}/processes")
async def get_device_processes(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    redis: Annotated[Redis, Depends(get_redis)],
):
    payload = await redis.get(f"process_list:{device_id}")
    if payload is None:
        raise HTTPException(status_code=404, detail="Process list not found")
    return json.loads(payload)


@router.get("/{device_id}/agent-logs")
async def get_agent_logs(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(200, ge=1, le=1000),
):
    result = await db.execute(
        select(Event)
        .where(
            Event.device_id == device_id,
            (Event.source.like("agent/%")) | (Event.event_type == "agent_log"),
        )
        .order_by(Event.time.desc())
        .limit(limit)
    )
    events = result.scalars().all()
    return [
        {
            "id": str(event.id),
            "time": event.time.isoformat(),
            "event_type": event.event_type,
            "source": event.source,
            "message": event.message,
        }
        for event in events
    ]


@router.post("/{device_id}/disconnect")
async def disconnect_device(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = DeviceService(db)
    await service.get_device(device_id)
    await manager.disconnect(device_id)
    return {"message": "Disconnected"}


def _default_device_config() -> dict:
    return {
        "telemetry_interval_secs": 60,
        "software_scan_interval_m": 60,
        "event_poll_interval_secs": 120,
    }


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"
