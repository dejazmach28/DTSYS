import uuid
import hashlib
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.device import Device
from app.core.security import generate_api_key, hash_api_key
from app.core.exceptions import ConflictError, NotFoundError
from app.core.logging import get_logger

log = get_logger(__name__)


class DeviceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_device(
        self,
        hostname: str,
        os_type: str,
        os_version: str | None,
        arch: str | None,
        fingerprint: str,
        ip_address: str | None,
    ) -> tuple[Device, str]:
        """Register a new device. Returns (device, raw_api_key)."""
        # Check if device with this fingerprint already exists
        result = await self.db.execute(
            select(Device).where(Device.fingerprint == fingerprint)
        )
        existing = result.scalar_one_or_none()
        if existing and not existing.is_revoked:
            raise ConflictError(f"Device with fingerprint already registered (id={existing.id})")

        raw_key = generate_api_key()
        device = Device(
            hostname=hostname,
            os_type=os_type,
            os_version=os_version,
            arch=arch,
            fingerprint=fingerprint,
            ip_address=ip_address,
            api_key_hash=hash_api_key(raw_key),
            status="offline",
        )
        self.db.add(device)
        await self.db.flush()
        log.info("device_registered", device_id=str(device.id), hostname=hostname)
        return device, raw_key

    async def get_device(self, device_id: uuid.UUID) -> Device:
        result = await self.db.execute(select(Device).where(Device.id == device_id))
        device = result.scalar_one_or_none()
        if not device:
            raise NotFoundError(f"Device {device_id} not found")
        return device

    async def revoke_device(self, device_id: uuid.UUID) -> Device:
        device = await self.get_device(device_id)
        device.is_revoked = True
        device.status = "offline"
        return device

    async def list_devices(self, skip: int = 0, limit: int = 100) -> list[Device]:
        result = await self.db.execute(
            select(Device).where(Device.is_revoked == False).offset(skip).limit(limit)
        )
        return list(result.scalars().all())
