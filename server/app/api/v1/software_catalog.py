from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.software import SoftwareInventory
from app.models.user import User

router = APIRouter(prefix="/software", tags=["software-catalog"])


@router.get("")
async def search_software(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str = Query(""),
):
    return await _search(db, search)


@router.get("/search")
async def search_software_explicit(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(""),
):
    return await _search(db, q)


async def _search(db: AsyncSession, query_text: str):
    query_text = query_text.strip()
    if not query_text:
        return []

    result = await db.execute(
        select(SoftwareInventory).where(SoftwareInventory.name.ilike(f"%{query_text}%"))
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
