import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.user import User
from app.models.event import Event
from app.dependencies import get_current_user

router = APIRouter(prefix="/devices/{device_id}/events", tags=["events"])


@router.get("")
async def get_events(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    event_type: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    query = (
        select(Event)
        .where(Event.device_id == device_id)
        .order_by(Event.time.desc())
        .limit(limit)
    )
    if event_type:
        query = query.where(Event.event_type == event_type)

    result = await db.execute(query)
    events = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "time": e.time.isoformat(),
            "event_type": e.event_type,
            "source": e.source,
            "message": e.message,
        }
        for e in events
    ]
