import uuid

import pytest

from app.core.exceptions import BadRequestError
from app.models.command import Command
from app.models.device import Device
from app.services.command_service import CommandService


@pytest.mark.asyncio
async def test_dispatch_command_offline_device(db_session):
    device = Device(id=uuid.uuid4(), hostname="offline-device", os_type="linux", api_key_hash="hash")
    db_session.add(device)

    service = CommandService(db_session)
    command = await service.dispatch_command(device.id, "shell", {"command": "echo ok"}, issued_by=None)

    assert command.status == "pending"
    assert len(db_session.items(Command)) == 1


@pytest.mark.asyncio
async def test_dispatch_invalid_type(db_session):
    service = CommandService(db_session)

    with pytest.raises(BadRequestError):
        await service.dispatch_command(uuid.uuid4(), "evil", {}, issued_by=None)
