import asyncio
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from app.dependencies import get_current_user
from app.models.user import User
from app.services.event_stream import alert_event_stream

router = APIRouter(prefix="/events", tags=["events-stream"])
MAX_SSE_CONNECTIONS = 10
_connection_counts: dict[str, int] = {}
_connection_lock = asyncio.Lock()


@router.get("/stream")
async def stream_alerts(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
):
    user_key = str(current_user.id)
    async with _connection_lock:
        current = _connection_counts.get(user_key, 0)
        if current >= MAX_SSE_CONNECTIONS:
            raise HTTPException(status_code=429, detail="Too many open event streams")
        _connection_counts[user_key] = current + 1

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
            async with _connection_lock:
                remaining = _connection_counts.get(user_key, 0) - 1
                if remaining <= 0:
                    _connection_counts.pop(user_key, None)
                else:
                    _connection_counts[user_key] = remaining

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
