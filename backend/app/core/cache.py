import os
from typing import Optional

import redis.asyncio as aioredis

_redis: Optional[aioredis.Redis] = None


def _client() -> Optional[aioredis.Redis]:
    """Lazily create a redis client. Returns None if REDIS_URL is unset."""
    global _redis
    if _redis is None:
        url = os.environ.get("REDIS_URL")
        if not url:
            return None
        _redis = aioredis.from_url(url, decode_responses=True)
    return _redis


async def cache_get(key: str) -> Optional[str]:
    """Get a value from cache. Returns None if missing or redis is unavailable."""
    client = _client()
    if client is None:
        return None
    try:
        return await client.get(key)
    except Exception:
        return None


async def cache_set(key: str, value: str, ttl: int = 30) -> None:
    """Set a value with a TTL (seconds). No-op if redis is unavailable."""
    client = _client()
    if client is None:
        return
    try:
        await client.set(key, value, ex=ttl)
    except Exception:
        return
