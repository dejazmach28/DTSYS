import uuid

import pytest

from app.core.exceptions import BadRequestError
from app.models.command import Command
from app.models.device import Device
from app.services.command_service import CommandService
from app.websocket.handler import MessageHandler


@pytest.mark.asyncio
async def test_dispatch_command_offline_device(db_session):
    device = Device(id=uuid.uuid4(), hostname="offline-device", os_type="linux", api_key_hash="hash")
    db_session.add(device)

    service = CommandService(db_session)
    command, sent = await service.dispatch_command(device.id, "shell", {"command": "echo ok"}, issued_by=None)

    assert sent is False
    assert command.status == "pending"
    assert len(db_session.items(Command)) == 1


@pytest.mark.asyncio
async def test_dispatch_invalid_type(db_session):
    service = CommandService(db_session)

    with pytest.raises(BadRequestError):
        await service.dispatch_command(uuid.uuid4(), "evil", {}, issued_by=None)


@pytest.mark.asyncio
async def test_handle_command_result_updates_command(db_session):
    device = Device(id=uuid.uuid4(), hostname="device-06", os_type="linux", api_key_hash="hash")
    db_session.add(device)
    command = Command(
        id=uuid.uuid4(),
        device_id=device.id,
        command_type="shell",
        payload={"command": "echo ok"},
        status="sent",
    )
    db_session.add(command)

    handler = MessageHandler(db_session, redis=None)
    await handler.handle(
        device,
        {
            "type": "command_result",
            "data": {"command_id": str(command.id), "exit_code": 0, "output": "ok"},
        },
    )

    assert command.status == "completed"
    assert command.exit_code == 0
    assert command.output == "ok"
    assert command.completed_at is not None
