from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.device import Device
from app.models.user import User

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("")
async def list_tags(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Device.tags).where(~Device.is_revoked))
    tag_values = result.scalars().all()
    tags = sorted({tag for tag_list in tag_values for tag in (tag_list or [])})
    return tags
