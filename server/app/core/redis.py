from functools import lru_cache

from redis.asyncio import Redis

from app.config import get_settings


@lru_cache
def _redis_client() -> Redis:
    settings = get_settings()
    return Redis.from_url(settings.REDIS_URL, decode_responses=True)


async def get_redis() -> Redis:
    return _redis_client()


async def check_rate_limit(redis: Redis, key: str, limit: int, window_secs: int) -> bool:
    current = await redis.incr(key)
    if current == 1:
        await redis.expire(key, window_secs)
    return current <= limit
