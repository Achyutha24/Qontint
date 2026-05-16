"""
In-memory cache replacing Redis for zero-dependency local run.
"""
from __future__ import annotations
import json
import logging
from typing import Any
from config import settings

logger = logging.getLogger(__name__)

# ── In-memory store ────────────────────────────────────────────────────────────
_mock_redis: dict[str, Any] = {}

class MockRedis:
    async def get(self, key):
        return _mock_redis.get(key)
    async def setex(self, key, ttl, value):
        _mock_redis[key] = value
    async def delete(self, key):
        _mock_redis.pop(key, None)
    async def exists(self, key):
        return key in _mock_redis
    async def ping(self):
        return True

def get_redis() -> MockRedis:
    return MockRedis()

async def close_redis() -> None:
    pass

async def redis_dependency() -> MockRedis:
    return get_redis()

# ── Cache helpers ─────────────────────────────────────────────────────────────
async def cache_get(key: str) -> Any | None:
    redis = get_redis()
    try:
        raw = await redis.get(key)
        if raw is None:
            return None
        return json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return None

async def cache_set(key: str, value: Any, ttl: int = 3600) -> bool:
    redis = get_redis()
    await redis.setex(key, ttl, json.dumps(value, default=str))
    return True

async def cache_delete(key: str) -> None:
    redis = get_redis()
    await redis.delete(key)

async def cache_exists(key: str) -> bool:
    redis = get_redis()
    return await redis.exists(key)

# ── Named cache key builders ──────────────────────────────────────────────────
def novelty_cache_key(content_hash: str, keyword: str) -> str:
    return f"novelty:{content_hash}:{keyword}"

def authority_cache_key(vertical: str) -> str:
    return f"authority:{vertical}:top50"

def ranking_cache_key(content_hash: str, vertical: str) -> str:
    return f"ranking:{content_hash}:{vertical}"

def serp_cache_key(keyword_id: str) -> str:
    return f"serp:results:{keyword_id}"

# ── Health check ──────────────────────────────────────────────────────────────
async def check_redis_health() -> bool:
    return True
