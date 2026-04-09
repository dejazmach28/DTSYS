import uuid
from collections.abc import AsyncIterator
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from httpx import ASGITransport, AsyncClient
from sqlalchemy.sql import operators
from sqlalchemy.sql.elements import BinaryExpression, BindParameter, BooleanClauseList, ColumnElement, UnaryExpression

from app.core.redis import get_redis
from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.main import app
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.command import Command
from app.models.device import Device
from app.models.notification_rule import NotificationRule
from app.models.user import User

ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class DummyScalarResult:
    def __init__(self, rows):
        self._rows = list(rows)

    def all(self):
        return list(self._rows)

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None

    def first(self):
        return self._rows[0] if self._rows else None


class DummyResult:
    def __init__(self, rows):
        self._rows = list(rows)

    def scalars(self):
        return DummyScalarResult(self._rows)

    def all(self):
        return list(self._rows)

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


class DummySession:
    def __init__(self):
        admin_user = User(
            id=ADMIN_ID,
            username="admin",
            password_hash=hash_password("changeme"),
            role="admin",
            is_active=True,
        )
        self._store = {
            User: [admin_user],
            Device: [],
            Alert: [],
            Command: [],
            AuditLog: [],
            NotificationRule: [],
        }

    async def execute(self, statement):
        entity = None
        descriptions = getattr(statement, "column_descriptions", [])
        if descriptions:
            entity = descriptions[0].get("entity")

        rows = list(self._store.get(entity, []))

        for criterion in getattr(statement, "_where_criteria", ()):
            rows = [row for row in rows if _matches(row, criterion)]

        order_by = list(getattr(statement, "_order_by_clauses", ()))
        if order_by:
            clause = order_by[0]
            reverse = getattr(clause, "modifier", None) == operators.desc_op
            key = _extract_key(getattr(clause, "element", clause))
            if key:
                rows.sort(key=lambda row: getattr(row, key) or datetime.min.replace(tzinfo=timezone.utc), reverse=reverse)

        limit_clause = getattr(statement, "_limit_clause", None)
        if isinstance(limit_clause, BindParameter):
            rows = rows[: int(limit_clause.value)]

        return DummyResult(rows)

    async def commit(self) -> None:
        return None

    async def rollback(self) -> None:
        return None

    async def close(self) -> None:
        return None

    async def flush(self) -> None:
        return None

    async def refresh(self, obj) -> None:
        return None

    async def get(self, model, pk):
        for obj in self._store.get(model, []):
            if getattr(obj, "id", None) == pk or getattr(obj, "device_id", None) == pk:
                return obj
        return None

    async def delete(self, obj) -> None:
        bucket = self._store.get(type(obj), [])
        if obj in bucket:
            bucket.remove(obj)

    def add(self, obj) -> None:
        _seed_defaults(obj)
        self._store.setdefault(type(obj), []).append(obj)

    def add_all(self, objects) -> None:
        for obj in objects:
            self.add(obj)

    def items(self, model):
        return list(self._store.get(model, []))


def _seed_defaults(obj) -> None:
    now = datetime.now(timezone.utc)
    if hasattr(obj, "id") and getattr(obj, "id", None) is None:
        setattr(obj, "id", uuid.uuid4())
    for attr in ("created_at", "enrolled_at", "timestamp", "time", "last_scanned", "updated_at"):
        if hasattr(obj, attr) and getattr(obj, attr) is None:
            setattr(obj, attr, now)
    if hasattr(obj, "is_resolved") and getattr(obj, "is_resolved") is None:
        setattr(obj, "is_resolved", False)
    if hasattr(obj, "is_active") and getattr(obj, "is_active") is None:
        setattr(obj, "is_active", True)
    if hasattr(obj, "is_revoked") and getattr(obj, "is_revoked") is None:
        setattr(obj, "is_revoked", False)
    if hasattr(obj, "status") and getattr(obj, "status") is None:
        setattr(obj, "status", "offline")
    if hasattr(obj, "payload") and getattr(obj, "payload") is None:
        setattr(obj, "payload", {})


def _matches(obj, criterion) -> bool:
    if isinstance(criterion, BooleanClauseList):
        return all(_matches(obj, clause) for clause in criterion.clauses)

    if isinstance(criterion, BinaryExpression):
        key = _extract_key(criterion.left)
        value = _extract_value(criterion.right)
        current = getattr(obj, key) if key else None
        if criterion.operator == operators.eq:
            return current == value
        if criterion.operator == operators.ne:
            return current != value
        if criterion.operator == operators.in_op:
            return current in value
        if criterion.operator == operators.ilike_op:
            needle = str(value).strip("%").lower()
            return needle in str(current or "").lower()
        return True

    if isinstance(criterion, UnaryExpression):
        key = _extract_key(criterion.element)
        if key:
            return not bool(getattr(obj, key))
        return True

    if isinstance(criterion, ColumnElement):
        key = _extract_key(criterion)
        if key:
            return bool(getattr(obj, key))

    return True


def _extract_key(expression) -> str | None:
    if hasattr(expression, "key") and expression.key is not None:
        return expression.key
    if hasattr(expression, "element"):
        return _extract_key(expression.element)
    if hasattr(expression, "expression"):
        return _extract_key(expression.expression)
    return None


def _extract_value(expression):
    if isinstance(expression, BindParameter):
        return expression.value
    return expression


@pytest_asyncio.fixture
async def fake_redis() -> AsyncIterator[FakeRedis]:
    redis = FakeRedis(decode_responses=True)
    try:
        yield redis
    finally:
        await redis.flushall()
        await redis.aclose()


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[DummySession]:
    yield DummySession()


@pytest_asyncio.fixture
async def client(fake_redis: FakeRedis, db_session: DummySession) -> AsyncIterator[AsyncClient]:
    async def override_get_db():
        yield db_session

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
