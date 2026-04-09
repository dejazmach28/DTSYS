from functools import lru_cache

from redis.asyncio import Redis

from app.config import get_settings


@lru_cache
def _redis_client() -> Redis:
    settings = get_settings()
    return Redis.from_url(settings.REDIS_URL, decode_responses=True)


async def get_redis() -> Redis:
    return _redis_client()
