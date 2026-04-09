import secrets
from typing import Annotated
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.db.session import get_db
from app.models.user import User
from app.dependencies import require_admin
from app.services.auth_service import AuthService

router = APIRouter(prefix="/admin", tags=["admin"])


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "viewer"


@router.post("/users")
async def create_user(
    body: CreateUserRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = AuthService(db)
    user = await service.create_user(body.username, body.password, body.role)
    await db.commit()
    return {"id": str(user.id), "username": user.username, "role": user.role}


@router.post("/enrollment-tokens")
async def generate_enrollment_token(
    current_user: Annotated[User, Depends(require_admin)],
    redis: Annotated[Redis, Depends(get_redis)],
):
    token = secrets.token_urlsafe(24)
    await redis.setex(f"enrollment:{token}", 3600, "valid")
    return {
        "enrollment_token": token,
        "expires_in_minutes": 60,
        "note": "Use this token once when registering a new device agent",
    }
