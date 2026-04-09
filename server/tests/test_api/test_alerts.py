import uuid

import pytest

from app.models.alert import Alert
from app.models.device import Device


@pytest.mark.asyncio
async def test_list_alerts_empty(client, admin_token):
    response = await client.get("/api/v1/alerts", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_resolve_alert(client, admin_token, db_session):
    device = Device(
        id=uuid.uuid4(),
        hostname="device-01",
        os_type="linux",
        api_key_hash="hash",
    )
    alert = Alert(
        id=uuid.uuid4(),
        device_id=device.id,
        alert_type="high_cpu",
        severity="warning",
        message="CPU is high",
    )
    db_session.add(device)
    db_session.add(alert)

    response = await client.post(f"/api/v1/alerts/{alert.id}/resolve", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    assert response.json()["is_resolved"] is True


@pytest.mark.asyncio
async def test_list_alerts_filter_severity(client, admin_token, db_session):
    device = Device(
        id=uuid.uuid4(),
        hostname="device-02",
        os_type="linux",
        api_key_hash="hash",
    )
    db_session.add(device)
    db_session.add(
        Alert(device_id=device.id, alert_type="crash", severity="critical", message="Crash")
    )
    db_session.add(
        Alert(device_id=device.id, alert_type="high_cpu", severity="warning", message="Warn")
    )

    response = await client.get(
        "/api/v1/alerts",
        params={"severity": "critical"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["severity"] == "critical"
