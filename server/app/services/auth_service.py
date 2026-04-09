import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.exceptions import UnauthorizedError


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate(self, username: str, password: str) -> User:
        result = await self.db.execute(
            select(User).where(User.username == username, User.is_active)
        )
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.password_hash):
            raise UnauthorizedError("Invalid username or password")
        user.last_login = datetime.now(timezone.utc)
        return user

    def issue_tokens(self, user: User) -> dict:
        return {
            "access_token": create_access_token(str(user.id), {"role": user.role, "username": user.username}),
            "refresh_token": create_refresh_token(str(user.id)),
            "token_type": "bearer",
        }

    async def refresh_access_token(self, refresh_token: str) -> dict:
        try:
            payload = decode_token(refresh_token)
        except ValueError:
            raise UnauthorizedError("Invalid refresh token")

        if payload.get("type") != "refresh":
            raise UnauthorizedError("Wrong token type")

        user_id = payload.get("sub")
        result = await self.db.execute(
            select(User).where(User.id == uuid.UUID(user_id), User.is_active)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise UnauthorizedError("User not found")

        return self.issue_tokens(user)

    async def create_user(self, username: str, password: str, role: str = "viewer") -> User:
        user = User(
            username=username,
            password_hash=hash_password(password),
            role=role,
        )
        self.db.add(user)
        await self.db.flush()
        return user
