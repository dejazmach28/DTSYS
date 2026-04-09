import uuid
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.user import User
from app.models.software import SoftwareInventory
from app.dependencies import get_current_user

router = APIRouter(prefix="/devices/{device_id}/software", tags=["software"])


@router.get("")
async def get_software_inventory(
    device_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(SoftwareInventory)
        .where(SoftwareInventory.device_id == device_id)
        .order_by(SoftwareInventory.name)
    )
    packages = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "version": p.version,
            "install_date": p.install_date.isoformat() if p.install_date else None,
            "update_available": p.update_available,
            "latest_version": p.latest_version,
            "last_scanned": p.last_scanned.isoformat(),
        }
        for p in packages
    ]
