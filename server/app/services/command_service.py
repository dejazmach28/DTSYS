import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.command import Command
from app.models.device import Device
from app.websocket.manager import manager
from app.websocket.messages import ServerMessageType
from app.core.exceptions import NotFoundError, BadRequestError, TooManyRequestsError
from app.core.logging import get_logger

log = get_logger(__name__)

ALLOWED_COMMAND_TYPES = {"shell", "script", "update_check", "reboot", "sync_time", "request_process_list", "diagnostics", "update"}


class CommandService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def dispatch_command(
        self,
        device_id: uuid.UUID,
        command_type: str,
        payload: dict,
        issued_by: uuid.UUID | None,
        *,
        fail_if_offline: bool = False,
    ) -> tuple[Command, bool]:
        if command_type not in ALLOWED_COMMAND_TYPES:
            raise BadRequestError(f"Command type must be one of: {ALLOWED_COMMAND_TYPES}")

        if command_type == "sync_time" and "target_time" not in payload:
            payload = {**payload, "target_time": datetime.now(timezone.utc).isoformat()}

        pending_count = int(
            await self.db.scalar(
                select(func.count())
                .select_from(Command)
                .where(
                    Command.device_id == device_id,
                    Command.status.in_(["pending", "sent"]),
                )
            )
            or 0
        )
        if pending_count >= 100:
            raise TooManyRequestsError("Too many queued commands for this device")

        # Verify device exists
        result = await self.db.execute(
            select(Device).where(Device.id == device_id, ~Device.is_revoked)
        )
        device = result.scalar_one_or_none()
        if not device:
            raise NotFoundError(f"Device {device_id} not found")

        command = Command(
            device_id=device_id,
            command_type=command_type,
            payload=payload,
            issued_by=issued_by,
            status="pending",
        )
        self.db.add(command)
        await self.db.flush()

        # Try to send immediately if device is online
        sent = await manager.send_to_device(
            device_id,
            {
                "type": ServerMessageType.COMMAND,
                "data": {
                    "command_id": str(command.id),
                    "command_type": command_type,
                    "payload": payload,
                },
            },
        )

        if sent:
            command.status = "sent"
            log.info("command_sent", command_id=str(command.id), device_id=str(device_id))
        else:
            log.warning("command_queued_device_offline", command_id=str(command.id))
            if fail_if_offline:
                command.status = "failed"
                command.output = "Device not connected"
                command.completed_at = datetime.now(timezone.utc)

        return command, sent

    async def get_command(self, command_id: uuid.UUID) -> Command:
        result = await self.db.execute(select(Command).where(Command.id == command_id))
        cmd = result.scalar_one_or_none()
        if not cmd:
            raise NotFoundError(f"Command {command_id} not found")
        return cmd
