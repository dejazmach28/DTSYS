import asyncio
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.dependencies import get_current_user
from app.models.user import User
from app.services.activity_stream import activity_event_stream

router = APIRouter(prefix="/events", tags=["activity-stream"])


@router.get("/activity-stream")
async def stream_activity(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
):
    queue = await activity_event_stream.subscribe()

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
            await activity_event_stream.unsubscribe(queue)

    return StreamingResponse(generator(), media_type="text/event-stream")
