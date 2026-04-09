import uuid

import pytest

from app.models.device import Device


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
