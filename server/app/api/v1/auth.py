from typing import Annotated
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.exceptions import UnauthorizedError
from app.services.auth_service import AuthService
from app.services.audit_service import log_action

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/login")
async def login(
    body: LoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = AuthService(db)
    try:
        user = await service.authenticate(body.username, body.password)
    except UnauthorizedError:
        await log_action(
            db,
            None,
            "login_failed",
            ip=request.client.host if request.client else None,
            details={"username": body.username},
            username=body.username,
        )
        await db.commit()
        raise
    tokens = service.issue_tokens(user)
    await log_action(
        db,
        user,
        "login_success",
        ip=request.client.host if request.client else None,
    )
    await db.commit()
    return tokens


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    service = AuthService(db)
    return await service.refresh_access_token(body.refresh_token)
