"""
M4 — Novelty Scorer (delegates to unified scoring engine).
"""
from __future__ import annotations

import hashlib
import logging
import time
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from db.redis_client import cache_get, cache_set, novelty_cache_key
from models.db import NoveltyHistory
from config import settings
from services.unified_analysis import run_unified_analysis

logger = logging.getLogger(__name__)


async def compute_novelty_score(
    content: str,
    keyword: str,
    vertical: str,
    db: AsyncSession,
    store_history: bool = True,
) -> dict[str, Any]:
    start = time.perf_counter()
    content_hash = hashlib.sha256(content.encode()).hexdigest()
    cache_key = novelty_cache_key(content_hash, keyword)
    cached = await cache_get(cache_key)
    if cached:
        logger.debug("Novelty cache hit: %s", cache_key)
        return cached

    unified = await run_unified_analysis(content, keyword, vertical, db)
    result = unified["novelty"]
    result["processing_time_ms"] = int((time.perf_counter() - start) * 1000)

    await cache_set(cache_key, result, ttl=settings.CACHE_NOVELTY_TTL)

    if store_history:
        db.add(NoveltyHistory(
            id=str(uuid.uuid4()),
            content_hash=content_hash,
            novelty_score=result["novelty_score"],
            similarity_score=result["similarity_score"],
            entity_novelty=result["entity_novelty"],
            relationship_novelty=result["relationship_novelty"],
            semantic_diversity=result["semantic_diversity"],
            passed=result["passed"],
            vertical=vertical,
        ))
        await db.commit()

    return result
