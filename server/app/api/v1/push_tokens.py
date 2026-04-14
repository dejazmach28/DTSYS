"""Push notification token registration endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.push_token import PushToken
from app.models.user import User

router = APIRouter(prefix="/push-tokens", tags=["push-tokens"])


class PushTokenRequest(BaseModel):
    token: str
    platform: str | None = None  # ios | android


@router.post("")
async def register_push_token(
    body: PushTokenRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await db.execute(select(PushToken).where(PushToken.token == body.token))
    pt = existing.scalar_one_or_none()
    if pt is None:
        pt = PushToken(user_id=current_user.id, token=body.token, platform=body.platform)
        db.add(pt)
    else:
        pt.user_id = current_user.id
        pt.platform = body.platform
    await db.commit()
    return {"message": "Push token registered"}


@router.delete("/{token}")
async def unregister_push_token(
    token: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await db.execute(
        delete(PushToken).where(PushToken.token == token, PushToken.user_id == current_user.id)
    )
    await db.commit()
    return {"message": "Push token removed"}
