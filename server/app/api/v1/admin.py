import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.redis import get_redis
from app.core.security import hash_password
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.device import Device
from app.models.user import User
from app.dependencies import get_current_user, require_admin
from app.services.auth_service import AuthService
from app.services.audit_service import log_action
from app.tasks.cleanup_tasks import collect_storage_stats, run_cleanup
from app.websocket.manager import manager

router = APIRouter(prefix="/admin", tags=["admin"])


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "viewer"


class UpdateUserRequest(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=255)


@router.post("/users")
async def create_user(
    body: CreateUserRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if body.role not in {"admin", "viewer"}:
        raise HTTPException(status_code=400, detail="Role must be admin or viewer")
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


@router.get("/users")
async def list_users(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).order_by(User.created_at.asc(), User.username.asc()))
    users = result.scalars().all()
    return [
        {
            "id": str(user.id),
            "username": user.username,
            "role": user.role,
            "is_active": user.is_active,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
        for user in users
    ]


@router.patch("/users/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role is not None:
        if body.role not in {"admin", "viewer"}:
            raise HTTPException(status_code=400, detail="Role must be admin or viewer")
        if user.id == current_user.id and body.role != "admin":
            raise HTTPException(status_code=400, detail="Cannot remove your own admin role")
        user.role = body.role

    if body.is_active is not None:
        if user.id == current_user.id and not body.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
        if not body.is_active and user.role == "admin":
            admin_count = int(
                await db.scalar(select(func.count()).select_from(User).where(User.role == "admin", User.is_active)) or 0
            )
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot deactivate the last admin")
        user.is_active = body.is_active

    await log_action(
        db,
        current_user,
        "user_updated",
        resource_type="user",
        resource_id=str(user.id),
        details=body.model_dump(exclude_none=True),
    )
    await db.commit()
    return {
        "id": str(user.id),
        "username": user.username,
        "role": user.role,
        "is_active": user.is_active,
    }


@router.patch("/users/{user_id}/password")
async def reset_user_password(
    user_id: uuid.UUID,
    body: ResetPasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role != "admin" and current_user.id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed to change this password")

    user.password_hash = hash_password(body.password)
    await log_action(
        db,
        current_user,
        "user_password_reset",
        resource_type="user",
        resource_id=str(user.id),
        details={"username": user.username},
    )
    await db.commit()
    return {"message": "Password updated"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    if user.role == "admin" and user.is_active:
        admin_count = int(
            await db.scalar(select(func.count()).select_from(User).where(User.role == "admin", User.is_active)) or 0
        )
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")

    user.is_active = False
    await log_action(
        db,
        current_user,
        "user_deleted",
        resource_type="user",
        resource_id=str(user.id),
        details={"username": user.username},
    )
    await db.commit()
    return {"message": "User deactivated"}


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
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user_id: uuid.UUID | None = Query(None),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
):
    filters = []
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if action:
        filters.append(AuditLog.action == action)
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)

    total = int(await db.scalar(select(func.count()).select_from(AuditLog).where(*filters)) or 0)
    response.headers["X-Total-Count"] = str(total)

    query = select(AuditLog).where(*filters).order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)

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


@router.get("/connections")
async def get_live_connections(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    snapshot = manager.connection_snapshot()
    if not snapshot:
        return {"total": 0, "devices": []}

    device_ids = [entry["device_id"] for entry in snapshot]
    result = await db.execute(select(Device).where(Device.id.in_(device_ids)))
    devices = {device.id: device for device in result.scalars().all()}

    return {
        "total": len(snapshot),
        "devices": [
            {
                "device_id": str(entry["device_id"]),
                "hostname": (devices.get(entry["device_id"]).label or devices.get(entry["device_id"]).hostname)
                if devices.get(entry["device_id"])
                else str(entry["device_id"]),
                "ip": entry["ip"],
                "connected_since": entry["connected_since"].isoformat(),
            }
            for entry in snapshot
        ],
    }


@router.get("/storage-stats")
async def get_storage_stats(
    current_user: Annotated[User, Depends(require_admin)],
):
    return await collect_storage_stats()


@router.post("/cleanup")
async def cleanup_now(
    current_user: Annotated[User, Depends(require_admin)],
):
    deleted = await run_cleanup()
    return {"deleted": deleted}
