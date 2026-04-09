import pytest
import uuid

from app.dependencies import get_current_user
from app.main import app
from app.models.user import User
from app.services.device_service import DeviceService


@pytest.mark.asyncio
async def test_list_devices_requires_auth(client):
    response = await client.get("/api/v1/devices")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_devices_empty(client, admin_token, monkeypatch):
    async def fake_list_devices(self, skip: int = 0, limit: int = 100):
        return []

    async def override_current_user():
        return User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            username="admin",
            password_hash="unused",
            role="admin",
            is_active=True,
        )

    monkeypatch.setattr(DeviceService, "list_devices", fake_list_devices)
    app.dependency_overrides[get_current_user] = override_current_user

    response = await client.get(
        "/api/v1/devices",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_register_device(client, fake_redis, monkeypatch):
    class RegisteredDevice:
        id = "11111111-1111-1111-1111-111111111111"

    async def fake_register_device(self, **kwargs):
        return RegisteredDevice(), "api-key-123"

    monkeypatch.setattr(DeviceService, "register_device", fake_register_device)

    token = "test-enrollment-token"
    await fake_redis.set(f"enrollment:{token}", "valid")

    response = await client.post(
        "/api/v1/devices/register",
        json={
            "hostname": "device-01",
            "os_type": "linux",
            "os_version": "Ubuntu 24.04",
            "arch": "amd64",
            "fingerprint": "fp-001",
            "ip_address": "10.0.0.10",
            "enrollment_token": token,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["device_id"]
    assert payload["api_key"]
