"""
Unified analysis entry point — single SERP-grounded scoring pass for all modules.
"""
from __future__ import annotations

import asyncio
import functools
import logging
import time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from analysis.scoring_engine import build_content_analysis, run_full_scoring
from config import settings
from services.serp_baseline import ensure_keyword_and_serp

logger = logging.getLogger(__name__)


def _build_and_score(content: str, keyword: str, vertical: str, serp_docs: list) -> dict[str, Any]:
    analysis = build_content_analysis(content, keyword, vertical, serp_docs)
    scores = run_full_scoring(analysis)
    return {
        "analysis": analysis,
        "scores": scores,
    }


async def run_unified_analysis(
    content: str,
    keyword: str,
    vertical: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Run full NLP + scoring pipeline with shared ContentAnalysis."""
    start = time.perf_counter()
    _, serp_docs = await ensure_keyword_and_serp(keyword, vertical, db, fast_mode=True)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        functools.partial(_build_and_score, content, keyword, vertical, serp_docs),
    )
    scores = result["scores"]
    elapsed_ms = int((time.perf_counter() - start) * 1000)

    novelty_result = {
        "novelty_score": scores.novelty_score,
        "similarity_score": scores.similarity_score,
        "entity_novelty": scores.entity_novelty,
        "relationship_novelty": scores.relationship_novelty,
        "semantic_diversity": scores.semantic_diversity,
        "passed": scores.passed,
        "threshold": scores.threshold,
        "verdict": scores.verdict,
        "reasoning": scores.reasoning,
        "processing_time_ms": elapsed_ms,
    }
    authority_result = {
        "matched_entities": scores.matched_entities,
        "missing_entities": scores.missing_entities,
        "authority_score": scores.authority_score,
    }
    ranking_result = {
        "predicted_rank": scores.predicted_rank,
        "confidence": scores.confidence,
        "ranking_factors": scores.ranking_factors,
        "optimization_gaps": scores.optimization_gaps,
        "model_version": "deterministic_serp_v2",
        "processing_time_ms": elapsed_ms,
    }

    return {
        "novelty": novelty_result,
        "authority": authority_result,
        "ranking": ranking_result,
        "serp_grounded": scores.serp_grounded,
        "debug": scores.debug,
        "total_processing_time_ms": elapsed_ms,
    }
