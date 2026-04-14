"""Push notification token registration endpoints."""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.push_token import PushToken
from app.models.user import User

router = APIRouter(prefix="/push-tokens", tags=["push-tokens"])

# Expo push token pattern: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]
_EXPO_TOKEN_RE = re.compile(r'^ExponentPushToken\[.{1,256}\]$')
# FCM / APNs direct tokens are hex strings up to 256 chars
_RAW_TOKEN_RE = re.compile(r'^[A-Za-z0-9:_\-]{8,256}$')

_MAX_TOKENS_PER_USER = 10


def _validate_token(token: str) -> str:
    if _EXPO_TOKEN_RE.match(token) or _RAW_TOKEN_RE.match(token):
        return token
    raise ValueError("Invalid push token format")


class PushTokenRequest(BaseModel):
    token: str
    platform: str | None = None  # ios | android

    @field_validator("token")
    @classmethod
    def token_format(cls, v: str) -> str:
        return _validate_token(v)

    @field_validator("platform")
    @classmethod
    def platform_allowed(cls, v: str | None) -> str | None:
        if v is not None and v not in ("ios", "android"):
            raise ValueError("platform must be 'ios' or 'android'")
        return v


@router.post("")
async def register_push_token(
    body: PushTokenRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Enforce per-user token limit
    count_result = await db.execute(
        select(func.count()).select_from(PushToken).where(PushToken.user_id == current_user.id)
    )
    token_count = count_result.scalar_one()

    existing_result = await db.execute(select(PushToken).where(PushToken.token == body.token))
    pt = existing_result.scalar_one_or_none()

    if pt is None:
        if token_count >= _MAX_TOKENS_PER_USER:
            # Remove the oldest token to stay within limit
            oldest_result = await db.execute(
                select(PushToken)
                .where(PushToken.user_id == current_user.id)
                .order_by(PushToken.created_at.asc())
                .limit(1)
            )
            oldest = oldest_result.scalar_one_or_none()
            if oldest:
                await db.delete(oldest)
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
    try:
        _validate_token(token)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid push token format")
    await db.execute(
        delete(PushToken).where(PushToken.token == token, PushToken.user_id == current_user.id)
    )
    await db.commit()
    return {"message": "Push token removed"}
