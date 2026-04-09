import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.core.logging import configure_logging
from app.core.redis import get_redis
from app.db.session import engine, Base
from app.api.v1.router import router as api_router
from app.websocket.router import router as ws_router
from app.websocket.manager import manager

settings = get_settings()
configure_logging()
APP_VERSION = "0.1.0"
START_TIME = time.monotonic()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables (in dev; in prod use Alembic migrations)
    if settings.ENVIRONMENT == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Seed initial admin user if not exists
    await _seed_admin()

    yield

    # Shutdown
    await engine.dispose()


async def _seed_admin():
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.models.user import User
    from app.core.security import hash_password

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        if not result.scalar_one_or_none():
            user = User(
                username="admin",
                password_hash=hash_password(settings.FIRST_ADMIN_PASSWORD),
                role="admin",
            )
            db.add(user)
            await db.commit()


app = FastAPI(
    title="DTSYS - Device Management System",
    description="IT device management platform",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if not settings.is_production else ["https://your-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)


@app.get("/health")
async def health():
    db_status = "ok"
    redis_status = "ok"

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    try:
        redis = await get_redis()
        await redis.ping()
    except Exception:
        redis_status = "error"

    status = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
    return {
        "status": status,
        "app": settings.APP_NAME,
        "version": APP_VERSION,
        "db": db_status,
        "redis": redis_status,
        "devices_online": manager.connection_count,
        "uptime_secs": int(time.monotonic() - START_TIME),
    }
