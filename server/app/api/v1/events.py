import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.event import Event
from app.models.device import Device
from app.dependencies import get_current_user, get_current_org_id

router = APIRouter(prefix="/devices/{device_id}/events", tags=["events"])


@router.get("")
async def get_events(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    current_org_id: Annotated[uuid.UUID, Depends(get_current_org_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    response: Response,
    event_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
):
    await _get_device_for_org(db, device_id, current_org_id)
    filters = [Event.device_id == device_id]
    if event_type:
        filters.append(Event.event_type == event_type)

    total = int(await db.scalar(select(func.count()).select_from(Event).where(*filters)) or 0)
    response.headers["X-Total-Count"] = str(total)

    query = select(Event).where(*filters).order_by(Event.time.desc()).offset(skip).limit(limit)

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


async def _get_device_for_org(db: AsyncSession, device_id: uuid.UUID, org_id: uuid.UUID) -> Device:
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.org_id == org_id, ~Device.is_revoked)
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device
