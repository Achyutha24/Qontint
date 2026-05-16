"""
M6 — Ranking Predictor (deterministic, SERP-grounded).
"""
from __future__ import annotations

import hashlib
import logging
import time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from db.redis_client import cache_get, cache_set, ranking_cache_key
from config import settings
from services.unified_analysis import run_unified_analysis

logger = logging.getLogger(__name__)


async def predict_ranking(
    content: str,
    vertical: str,
    novelty_score: float,
    entity_coverage: float,
    db: AsyncSession,
    keyword: str | None = None,
) -> dict[str, Any]:
    """
    Predict SERP ranking using unified analysis when keyword is provided.
  Otherwise uses cached unified run keyed by content hash only.
    """
    start = time.perf_counter()
    content_hash = hashlib.sha256(content.encode()).hexdigest()
    cache_key = ranking_cache_key(content_hash, vertical)

    cached = await cache_get(cache_key)
    if cached and keyword is None:
        return cached

    if keyword:
        unified = await run_unified_analysis(content, keyword, vertical, db)
        result = unified["ranking"]
    else:
        from analysis.scoring_engine import build_content_analysis, run_full_scoring
        analysis = build_content_analysis(content, keyword or "", vertical, [])
        scores = run_full_scoring(analysis)
        result = {
            "predicted_rank": scores.predicted_rank,
            "confidence": scores.confidence,
            "ranking_factors": scores.ranking_factors,
            "optimization_gaps": scores.optimization_gaps,
            "model_version": "deterministic_serp_v2",
        }

    result["processing_time_ms"] = int((time.perf_counter() - start) * 1000)
    await cache_set(cache_key, result, ttl=settings.CACHE_RANKING_TTL)
    return result


async def train_ranking_model(
    vertical: str,
    db: AsyncSession,
    force_retrain: bool = False,
) -> dict[str, Any]:
    logger.info("train_ranking_model skipped — deterministic_serp_v2 active for %s", vertical)
    return {"vertical": vertical, "status": "skipped", "reason": "deterministic_serp_v2 active"}
