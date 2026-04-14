import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import require_admin, get_current_org_id
from app.models.user import User
from app.models.device import Device
from sqlalchemy import select
from app.services.command_service import CommandService

router = APIRouter(prefix="/commands/bulk", tags=["commands"])


class BulkCommandRequest(BaseModel):
    device_ids: list[uuid.UUID] = Field(min_length=1)
    command_type: str
    payload: dict = {}

    @field_validator("payload")
    @classmethod
    def validate_shell_payload(cls, payload: dict) -> dict:
        command = payload.get("command")
        if isinstance(command, str) and len(command) > 10000:
            raise ValueError("shell command payload must be 10000 characters or less")
        return payload


@router.post("")
async def dispatch_bulk_command(
    body: BulkCommandRequest,
    current_user: Annotated[User, Depends(require_admin)],
    current_org_id: Annotated[uuid.UUID, Depends(get_current_org_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = CommandService(db)
    dispatched: list[dict] = []
    failed: list[dict] = []

    result = await db.execute(
        select(Device.id).where(Device.org_id == current_org_id, Device.id.in_(body.device_ids))
    )
    allowed_ids = {row[0] for row in result.all()}

    for device_id in body.device_ids:
        if device_id not in allowed_ids:
            failed.append({"device_id": str(device_id), "error": "Device not found"})
            continue
        try:
            async with db.begin_nested():
                cmd, _sent = await service.dispatch_command(
                    device_id=device_id,
                    command_type=body.command_type,
                    payload=body.payload,
                    issued_by=current_user.id,
                )
            dispatched.append({
                "device_id": str(device_id),
                "command_id": str(cmd.id),
            })
        except Exception as exc:
            failed.append({
                "device_id": str(device_id),
                "error": str(exc),
            })

    await db.commit()
    return {"dispatched": dispatched, "failed": failed}
