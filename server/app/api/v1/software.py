import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
):
    total = int(
        await db.scalar(
            select(func.count()).select_from(SoftwareInventory).where(SoftwareInventory.device_id == device_id)
        )
        or 0
    )
    response.headers["X-Total-Count"] = str(total)
    result = await db.execute(
        select(SoftwareInventory)
        .where(SoftwareInventory.device_id == device_id)
        .order_by(SoftwareInventory.name)
        .offset(skip)
        .limit(limit)
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
