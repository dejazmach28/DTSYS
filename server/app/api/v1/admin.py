import secrets
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.redis import get_redis
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.dependencies import require_admin
from app.services.auth_service import AuthService
from app.services.audit_service import log_action

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
    await log_action(
        db,
        current_user,
        "user_created",
        resource_type="user",
        resource_id=str(user.id),
        details={"username": user.username, "role": user.role},
    )
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


@router.get("/audit-log")
async def get_audit_log(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(100, ge=1, le=500),
    user_id: uuid.UUID | None = Query(None),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
):
    query = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)

    result = await db.execute(query)
    entries = result.scalars().all()
    return [
        {
            "id": str(entry.id),
            "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
            "user_id": str(entry.user_id) if entry.user_id else None,
            "username": entry.username,
            "action": entry.action,
            "resource_type": entry.resource_type,
            "resource_id": entry.resource_id,
            "ip_address": entry.ip_address,
            "details": entry.details,
        }
        for entry in entries
    ]


@router.get("/auth-config")
async def get_auth_config(
    current_user: Annotated[User, Depends(require_admin)],
):
    settings = get_settings()
    return {
        "mode": "LDAP" if settings.LDAP_ENABLED else "Local",
        "ldap_enabled": settings.LDAP_ENABLED,
        "ldap_server": settings.LDAP_SERVER,
        "ldap_port": settings.LDAP_PORT,
        "ldap_use_ssl": settings.LDAP_USE_SSL,
        "ldap_base_dn": settings.LDAP_BASE_DN,
        "ldap_user_filter": settings.LDAP_USER_FILTER,
        "ldap_admin_group_dn": settings.LDAP_ADMIN_GROUP_DN,
    }
