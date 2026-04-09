import uuid
from datetime import datetime, timezone
from typing import Annotated

from croniter import croniter
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import require_admin
from app.models.scheduled_command import ScheduledCommand
from app.models.user import User

router = APIRouter(prefix="/scheduled-commands", tags=["scheduled-commands"])


class ScheduledCommandCreateRequest(BaseModel):
    device_id: uuid.UUID | None = None
    command_type: str
    payload: dict = {}
    cron_expression: str
    is_enabled: bool = True


class ScheduledCommandUpdateRequest(BaseModel):
    device_id: uuid.UUID | None = None
    command_type: str | None = None
    payload: dict | None = None
    cron_expression: str | None = None
    is_enabled: bool | None = None


@router.get("")
async def list_scheduled_commands(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ScheduledCommand).order_by(ScheduledCommand.created_at.desc())
    )
    return [_fmt_scheduled_command(item) for item in result.scalars().all()]


@router.post("")
async def create_scheduled_command(
    body: ScheduledCommandCreateRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    next_run = _compute_next_run(body.cron_expression)
    scheduled = ScheduledCommand(
        device_id=body.device_id,
        command_type=body.command_type,
        payload=body.payload,
        cron_expression=body.cron_expression,
        is_enabled=body.is_enabled,
        next_run_at=next_run if body.is_enabled else None,
        created_by=current_user.id,
    )
    db.add(scheduled)
    await db.commit()
    await db.refresh(scheduled)
    return _fmt_scheduled_command(scheduled)


@router.patch("/{scheduled_command_id}")
async def update_scheduled_command(
    scheduled_command_id: uuid.UUID,
    body: ScheduledCommandUpdateRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    scheduled = await db.get(ScheduledCommand, scheduled_command_id)
    if scheduled is None:
        return {"detail": "Scheduled command not found"}

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(scheduled, field, value)

    if scheduled.is_enabled:
        scheduled.next_run_at = _compute_next_run(scheduled.cron_expression)
    else:
        scheduled.next_run_at = None

    await db.commit()
    await db.refresh(scheduled)
    return _fmt_scheduled_command(scheduled)


@router.delete("/{scheduled_command_id}")
async def delete_scheduled_command(
    scheduled_command_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    scheduled = await db.get(ScheduledCommand, scheduled_command_id)
    if scheduled is None:
        return {"detail": "Scheduled command not found"}
    await db.delete(scheduled)
    await db.commit()
    return {"message": "Deleted"}


def _compute_next_run(expression: str) -> datetime:
    return croniter(expression, datetime.now(timezone.utc)).get_next(datetime)


def _fmt_scheduled_command(item: ScheduledCommand) -> dict:
    return {
        "id": str(item.id),
        "device_id": str(item.device_id) if item.device_id else None,
        "command_type": item.command_type,
        "payload": item.payload,
        "cron_expression": item.cron_expression,
        "is_enabled": item.is_enabled,
        "last_run_at": item.last_run_at.isoformat() if item.last_run_at else None,
        "next_run_at": item.next_run_at.isoformat() if item.next_run_at else None,
        "created_by": str(item.created_by) if item.created_by else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }
