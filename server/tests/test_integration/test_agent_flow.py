import pytest


@pytest.mark.asyncio
async def test_agent_registration_flow(client, admin_token):
    token_response = await client.post(
        "/api/v1/admin/enrollment-tokens",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert token_response.status_code == 200
    enrollment_token = token_response.json()["enrollment_token"]

    register_payload = {
        "hostname": "agent-flow-device",
        "os_type": "linux",
        "os_version": "Ubuntu 24.04",
        "arch": "amd64",
        "fingerprint": "agent-flow-fingerprint",
        "ip_address": "10.0.0.20",
        "enrollment_token": enrollment_token,
    }

    register_response = await client.post("/api/v1/devices/register", json=register_payload)
    assert register_response.status_code == 200
    registered = register_response.json()
    device_id = registered["device_id"]
    assert registered["api_key"]

    second_response = await client.post("/api/v1/devices/register", json=register_payload)
    assert second_response.status_code == 400

    list_response = await client.get("/api/v1/devices", headers={"Authorization": f"Bearer {admin_token}"})
    assert list_response.status_code == 200
    assert any(device["id"] == device_id for device in list_response.json())

    patch_response = await client.patch(
        f"/api/v1/devices/{device_id}",
        json={"label": "Test PC"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert patch_response.status_code == 200

    get_response = await client.get(
        f"/api/v1/devices/{device_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert get_response.status_code == 200
    assert get_response.json()["label"] == "Test PC"

    delete_response = await client.delete(
        f"/api/v1/devices/{device_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert delete_response.status_code == 200

    final_list_response = await client.get("/api/v1/devices", headers={"Authorization": f"Bearer {admin_token}"})
    assert final_list_response.status_code == 200
    assert all(device["id"] != device_id for device in final_list_response.json())
