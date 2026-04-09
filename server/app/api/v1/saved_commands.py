"""Saved command library endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.saved_command import SavedCommand
from app.models.user import User

router = APIRouter(prefix="/saved-commands", tags=["saved-commands"])


class SavedCommandRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    command_type: str
    payload: dict = Field(default_factory=dict)
    is_global: bool = False
    device_id: uuid.UUID | None = None


@router.get("")
async def list_saved_commands(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(SavedCommand)
        .where(or_(SavedCommand.created_by == current_user.id, SavedCommand.is_global))
        .order_by(SavedCommand.name.asc())
    )
    commands = result.scalars().all()
    return [
        {
            "id": str(command.id),
            "name": command.name,
            "description": command.description,
            "command_type": command.command_type,
            "payload": command.payload,
            "is_global": command.is_global,
            "created_by": str(command.created_by) if command.created_by else None,
            "device_id": str(command.device_id) if command.device_id else None,
            "created_at": command.created_at.isoformat() if command.created_at else None,
        }
        for command in commands
    ]


@router.post("")
async def create_saved_command(
    body: SavedCommandRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if body.is_global and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create global commands")
    command = SavedCommand(
        name=body.name,
        description=body.description,
        command_type=body.command_type,
        payload=body.payload,
        created_by=current_user.id,
        is_global=body.is_global,
        device_id=body.device_id,
    )
    db.add(command)
    await db.commit()
    await db.refresh(command)
    return {
        "id": str(command.id),
        "name": command.name,
        "description": command.description,
        "command_type": command.command_type,
        "payload": command.payload,
        "is_global": command.is_global,
        "created_by": str(command.created_by) if command.created_by else None,
        "device_id": str(command.device_id) if command.device_id else None,
        "created_at": command.created_at.isoformat() if command.created_at else None,
    }


@router.patch("/{command_id}")
async def update_saved_command(
    command_id: uuid.UUID,
    body: SavedCommandRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    command = await db.get(SavedCommand, command_id)
    if command is None:
        raise HTTPException(status_code=404, detail="Saved command not found")
    if command.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed to edit this saved command")
    if body.is_global and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create global commands")

    for field, value in body.model_dump().items():
        setattr(command, field, value)
    await db.commit()
    return {"message": "Saved command updated"}


@router.delete("/{command_id}")
async def delete_saved_command(
    command_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    command = await db.get(SavedCommand, command_id)
    if command is None:
        raise HTTPException(status_code=404, detail="Saved command not found")
    if command.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed to delete this saved command")
    await db.delete(command)
    await db.commit()
    return {"message": "Saved command deleted"}
