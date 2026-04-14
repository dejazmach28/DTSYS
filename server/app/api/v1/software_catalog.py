from collections import defaultdict
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user, get_current_org_id
from app.models.software import SoftwareInventory
from app.models.device import Device
from app.models.user import User

router = APIRouter(prefix="/software", tags=["software-catalog"])


@router.get("")
async def search_software(
    current_user: Annotated[User, Depends(get_current_user)],
    current_org_id: Annotated[uuid.UUID, Depends(get_current_org_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str = Query(""),
):
    return await _search(db, search, current_org_id)


@router.get("/search")
async def search_software_explicit(
    current_user: Annotated[User, Depends(get_current_user)],
    current_org_id: Annotated[uuid.UUID, Depends(get_current_org_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(""),
):
    return await _search(db, q, current_org_id)


async def _search(db: AsyncSession, query_text: str, org_id: uuid.UUID):
    query_text = query_text.strip()
    if not query_text:
        return []

    result = await db.execute(
        select(SoftwareInventory)
        .join(Device, SoftwareInventory.device_id == Device.id)
        .where(
            SoftwareInventory.name.ilike(f"%{query_text}%"),
            Device.org_id == org_id,
        )
    )
    packages = result.scalars().all()
    grouped = defaultdict(lambda: {"device_ids": set(), "versions": set()})

    for package in packages:
        grouped[package.name]["device_ids"].add(str(package.device_id))
        if package.version:
            grouped[package.name]["versions"].add(package.version)

    return [
        {
            "name": name,
            "device_count": len(data["device_ids"]),
            "versions": sorted(data["versions"]),
        }
        for name, data in sorted(grouped.items())
    ]
