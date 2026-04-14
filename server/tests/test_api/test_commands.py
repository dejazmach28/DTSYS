import uuid

import pytest
from sqlalchemy import select

from app.models.command import Command
from app.models.device import Device
from app.websocket.manager import manager


@pytest.mark.asyncio
async def test_dispatch_command_device_not_found(client, admin_token):
    response = await client.post(
        f"/api/v1/devices/{uuid.uuid4()}/commands",
        json={"command_type": "shell", "payload": {"command": "echo test"}},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_commands_empty(client, admin_token, db_session):
    device = Device(
        id=uuid.uuid4(),
        hostname="device-03",
        os_type="linux",
        api_key_hash="hash",
    )
    db_session.add(device)

    response = await client.get(
        f"/api/v1/devices/{device.id}/commands",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_dispatch_command_success(client, admin_token, db_session):
    device = Device(
        id=uuid.uuid4(),
        hostname="device-04",
        os_type="linux",
        api_key_hash="hash",
    )
    db_session.add(device)

    response = await client.post(
        f"/api/v1/devices/{device.id}/commands",
        json={"command_type": "shell", "payload": {"command": "echo ok"}},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["command_id"]


@pytest.mark.asyncio
async def test_dispatch_shell_command_sends_to_agent(client, admin_token, db_session, monkeypatch):
    device = Device(
        id=uuid.uuid4(),
        hostname="device-05",
        os_type="linux",
        api_key_hash="hash",
    )
    db_session.add(device)

    sent_messages: list[dict] = []

    async def fake_send(device_id, message):
        sent_messages.append({"device_id": device_id, "message": message})
        return True

    monkeypatch.setattr(manager, "send_to_device", fake_send)

    response = await client.post(
        f"/api/v1/devices/{device.id}/commands",
        json={"command_type": "shell", "payload": {"command": "uname -a"}},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    command_id = response.json()["command_id"]

    result = await db_session.execute(
        select(Command).where(Command.id == uuid.UUID(command_id))
    )
    command = result.scalar_one_or_none()
    assert command is not None
    assert command.status == "sent"
    assert command.payload["command"] == "uname -a"

    assert sent_messages
    sent_payload = sent_messages[0]["message"]
    assert sent_payload["type"] == "command"
    assert sent_payload["data"]["command_type"] == "shell"
    assert sent_payload["data"]["payload"]["command"] == "uname -a"
