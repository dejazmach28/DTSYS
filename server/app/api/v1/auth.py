from typing import Annotated
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import check_rate_limit, get_redis
from app.db.session import get_db
from app.core.exceptions import UnauthorizedError
from app.core.rate_limit import limiter
from app.services.auth_service import AuthService
from app.services.audit_service import log_action

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
):
    client_ip = _get_client_ip(request)
    rate_limit_key = f"rate_limit:login:{client_ip}"
    if not await check_rate_limit(redis, rate_limit_key, limit=10, window_secs=60):
        response.headers["Retry-After"] = "60"
        return Response(
            content='{"detail":"Too many login attempts"}',
            status_code=429,
            media_type="application/json",
            headers={"Retry-After": "60"},
        )

    service = AuthService(db)
    try:
        user = await service.authenticate(body.username, body.password)
    except UnauthorizedError:
        await log_action(
            db,
            None,
            "login_failed",
            ip=client_ip,
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
        ip=client_ip,
    )
    await db.commit()
    return tokens


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    service = AuthService(db)
    return await service.refresh_access_token(body.refresh_token)


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"
