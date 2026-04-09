import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from httpx import ASGITransport, AsyncClient

from app.core.redis import get_redis
from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app

ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class DummySession:
    async def commit(self) -> None:
        return None

    async def rollback(self) -> None:
        return None

    async def close(self) -> None:
        return None


@pytest_asyncio.fixture
async def fake_redis() -> AsyncIterator[FakeRedis]:
    redis = FakeRedis(decode_responses=True)
    try:
        yield redis
    finally:
        await redis.flushall()
        await redis.aclose()


@pytest_asyncio.fixture
async def client(fake_redis: FakeRedis) -> AsyncIterator[AsyncClient]:
    async def override_get_db():
        yield DummySession()

    async def override_get_redis():
        return fake_redis

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
def admin_token() -> str:
    return create_access_token(str(ADMIN_ID), {"role": "admin", "username": "admin"})
