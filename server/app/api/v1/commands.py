import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.command import Command
from app.dependencies import get_current_user
from app.services.audit_service import log_action
from app.services.command_service import CommandService

router = APIRouter(prefix="/devices/{device_id}/commands", tags=["commands"])


class CommandRequest(BaseModel):
    command_type: str  # shell|script|update_check|reboot
    payload: dict = {}

    @field_validator("payload")
    @classmethod
    def validate_shell_payload(cls, payload: dict) -> dict:
        command = payload.get("command")
        if isinstance(command, str) and len(command) > 10000:
            raise ValueError("shell command payload must be 10000 characters or less")
        return payload


@router.post("")
async def dispatch_command(
    device_id: uuid.UUID,
    body: CommandRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = CommandService(db)
    cmd = await service.dispatch_command(
        device_id=device_id,
        command_type=body.command_type,
        payload=body.payload,
        issued_by=current_user.id,
    )
    await log_action(
        db,
        current_user,
        "command_dispatched",
        resource_type="device",
        resource_id=str(device_id),
        details={"command_type": body.command_type},
    )
    await db.commit()
    return {
        "command_id": str(cmd.id),
        "status": cmd.status,
        "message": "Command dispatched",
    }


@router.get("")
async def list_commands(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    response: Response,
    skip: int = 0,
    limit: int = 50,
):
    total = int(
        await db.scalar(
            select(func.count()).select_from(Command).where(Command.device_id == device_id)
        )
        or 0
    )
    response.headers["X-Total-Count"] = str(total)
    result = await db.execute(
        select(Command)
        .where(Command.device_id == device_id)
        .order_by(Command.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    cmds = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "command_type": c.command_type,
            "payload": c.payload,
            "status": c.status,
            "exit_code": c.exit_code,
            "created_at": c.created_at.isoformat(),
            "completed_at": c.completed_at.isoformat() if c.completed_at else None,
            "output": c.output,
        }
        for c in cmds
    ]


@router.get("/{command_id}")
async def get_command(
    device_id: uuid.UUID,
    command_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = CommandService(db)
    cmd = await service.get_command(command_id)
    return {
        "id": str(cmd.id),
        "command_type": cmd.command_type,
        "payload": cmd.payload,
        "status": cmd.status,
        "exit_code": cmd.exit_code,
        "output": cmd.output,
        "created_at": cmd.created_at.isoformat(),
        "started_at": cmd.started_at.isoformat() if cmd.started_at else None,
        "completed_at": cmd.completed_at.isoformat() if cmd.completed_at else None,
    }
