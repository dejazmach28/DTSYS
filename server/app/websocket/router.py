import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone

from app.core.redis import get_redis
from app.db.session import get_db
from app.models.device import Device
from app.core.security import verify_api_key
from app.websocket.manager import manager
from app.websocket.handler import MessageHandler
from app.core.logging import get_logger

router = APIRouter()
log = get_logger(__name__)


@router.websocket("/ws/device/{device_id}")
async def device_websocket(
    device_id: uuid.UUID,
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    client_ip = websocket.client.host if websocket.client else "unknown"
    attempts_key = f"ws_attempts:{client_ip}"

    attempts = await redis.incr(attempts_key)
    if attempts == 1:
        await redis.expire(attempts_key, 60)
    if attempts > 10:
        await websocket.close(code=4029)
        log.warning("ws_rate_limited", device_id=str(device_id), ip=client_ip, attempts=attempts)
        return

    # Authenticate device
    result = await db.execute(
        select(Device).where(Device.id == device_id, ~Device.is_revoked)
    )
    device = result.scalar_one_or_none()

    if device is None or not verify_api_key(token, device.api_key_hash):
        await websocket.close(code=4001)
        log.warning("ws_auth_failed", device_id=str(device_id))
        return

    await redis.delete(attempts_key)
    await manager.connect(device_id, websocket)

    # Update device status
    await db.execute(
        update(Device)
        .where(Device.id == device_id)
        .values(status="online", last_seen=datetime.now(timezone.utc))
    )
    await db.commit()

    handler = MessageHandler(db)

    try:
        while True:
            message = await websocket.receive_json()
            await handler.handle(device, message)
            await db.commit()
            await websocket.send_json({"type": "ack"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.error("ws_error", device_id=str(device_id), error=str(e))
    finally:
        await manager.disconnect(device_id)
        await db.execute(
            update(Device).where(Device.id == device_id).values(status="offline")
        )
        await db.commit()
