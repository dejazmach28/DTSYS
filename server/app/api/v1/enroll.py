"""Agent enrollment endpoint for installer flows."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import limiter
from app.core.redis import check_rate_limit, get_redis
from app.db.session import get_db
from app.services.device_service import DeviceService

router = APIRouter(prefix="/enroll", tags=["enroll"])


class EnrollRequest(BaseModel):
    hostname: str
    os_type: str
    os_version: str | None = None
    arch: str | None = None
    fingerprint: str
    ip_address: str | None = None
    enrollment_token: str


@router.post("")
@limiter.limit("30/minute")
async def enroll_device(
    body: EnrollRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
):
    client_ip = request.client.host if request.client else "unknown"
    if not await check_rate_limit(redis, f"rate_limit:enroll:{client_ip}", limit=30, window_secs=60):
        raise HTTPException(status_code=429, detail="Too many enrollment attempts")

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
    return {"device_id": str(device.id), "api_key": raw_key}
