import uuid

import pytest

from app.models.alert import Alert
from app.models.device import Device
from app.models.metrics import DeviceMetric
from app.services.alert_service import AlertService


@pytest.mark.asyncio
async def test_create_alert(db_session):
    device = Device(id=uuid.uuid4(), hostname="service-device", os_type="linux", api_key_hash="hash")
    db_session.add(device)

    service = AlertService(db_session)
    alert = await service.create_alert(device, "high_cpu", "warning", "CPU high")

    assert alert.alert_type == "high_cpu"
    assert len(db_session.items(Alert)) == 1


@pytest.mark.asyncio
async def test_create_alert_deduplication(db_session):
    device = Device(id=uuid.uuid4(), hostname="service-device", os_type="linux", api_key_hash="hash")
    db_session.add(device)

    service = AlertService(db_session)
    await service.create_alert(device, "high_cpu", "warning", "CPU high")
    await service.create_alert(device, "high_cpu", "warning", "CPU high")

    assert len(db_session.items(Alert)) == 1


@pytest.mark.asyncio
async def test_evaluate_metrics_high_cpu(db_session):
    device = Device(id=uuid.uuid4(), hostname="cpu-device", os_type="linux", api_key_hash="hash")
    metric = DeviceMetric(device_id=device.id, cpu_percent=95)

    service = AlertService(db_session)
    await service.evaluate_metrics(device, metric)

    assert len(db_session.items(Alert)) == 1
    assert db_session.items(Alert)[0].alert_type == "high_cpu"


@pytest.mark.asyncio
async def test_evaluate_metrics_normal(db_session):
    device = Device(id=uuid.uuid4(), hostname="normal-device", os_type="linux", api_key_hash="hash")
    metric = DeviceMetric(device_id=device.id, cpu_percent=50)

    service = AlertService(db_session)
    await service.evaluate_metrics(device, metric)

    assert db_session.items(Alert) == []
