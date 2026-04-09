import asyncio
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis

from app.core.redis import get_redis
from app.dependencies import get_current_user
from app.models.user import User
from app.services.event_stream import alert_event_stream

router = APIRouter(prefix="/events", tags=["events-stream"])


@router.get("/stream")
async def stream_alerts(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    redis: Annotated[Redis, Depends(get_redis)],
):
    connection_key = f"sse_connections:{current_user.id}"
    connection_count = await redis.incr(connection_key)
    if connection_count == 1:
        await redis.expire(connection_key, 3600)
    if connection_count > 3:
        await redis.decr(connection_key)
        raise HTTPException(status_code=429, detail="Too many open event streams")

    queue = await alert_event_stream.subscribe()

    async def generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(payload)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            await alert_event_stream.unsubscribe(queue)
            remaining = await redis.decr(connection_key)
            if remaining <= 0:
                await redis.delete(connection_key)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
