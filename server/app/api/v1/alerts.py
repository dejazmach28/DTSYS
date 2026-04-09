import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.alert import Alert
from app.dependencies import get_current_user
from app.services.alert_service import AlertService

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    response: Response,
    device_id: uuid.UUID | None = Query(None),
    resolved: bool | None = Query(None),
    severity: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    filters = []
    if device_id:
        filters.append(Alert.device_id == device_id)
    if resolved is not None:
        filters.append(Alert.is_resolved == resolved)
    if severity:
        filters.append(Alert.severity == severity)

    total = int(await db.scalar(select(func.count()).select_from(Alert).where(*filters)) or 0)
    response.headers["X-Total-Count"] = str(total)

    query = (
        select(Alert)
        .where(*filters)
        .order_by(Alert.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    alerts = result.scalars().all()
    return [_fmt(a) for a in alerts]


@router.post("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = AlertService(db)
    alert = await service.resolve_alert(alert_id)
    await db.commit()
    return _fmt(alert)


def _fmt(a: Alert) -> dict:
    return {
        "id": str(a.id),
        "device_id": str(a.device_id),
        "alert_type": a.alert_type,
        "severity": a.severity,
        "message": a.message,
        "is_resolved": a.is_resolved,
        "created_at": a.created_at.isoformat(),
        "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
    }
