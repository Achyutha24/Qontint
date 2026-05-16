"""
M5 — Authority Calculator (SERP-grounded via unified scoring engine).
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from analysis.scoring_engine import build_content_analysis, score_authority
from config import settings
from services.serp_baseline import ensure_keyword_and_serp
import asyncio
import functools

logger = logging.getLogger(__name__)


async def get_top_authority_entities_for_prompt(vertical: str, top_n: int = 15) -> list[dict]:
    """Entities for generation prompts — prefers recent SERP-derived lists when available."""
    from analysis.relationships import get_top_authority_entities
    try:
        entities = await get_top_authority_entities(vertical=vertical, limit=top_n)
        if entities:
            return [
                {"text": e["text"], "authority_score": e.get("authority_score", 0.5), "type": e.get("type", "CONCEPT")}
                for e in entities
            ]
    except Exception as exc:
        logger.warning("Authority entity lookup failed: %s", exc)
    return []


async def calculate_authority_coverage(
    content: str,
    vertical: str,
    top_n: int = 20,
    db: AsyncSession | None = None,
    keyword: str | None = None,
) -> dict[str, Any]:
    """
    Authority coverage vs SERP-derived entity leaders.
    Pass keyword + db for SERP-grounded baseline; otherwise uses content-only fallback.
    """
    if db is not None and keyword:
        _, serp_docs = await ensure_keyword_and_serp(keyword, vertical, db)
        loop = asyncio.get_event_loop()
        analysis = await loop.run_in_executor(
            None,
            functools.partial(
                build_content_analysis,
                content,
                keyword,
                vertical,
                serp_docs,
            ),
        )
        return score_authority(analysis, top_n=top_n)

    # Legacy path without SERP
    from analysis.entities import extract_entities_from_text
    content_entities = extract_entities_from_text(content, vertical, max_len=settings.ANALYZE_NLP_MAX_LEN)
    content_set = {e["text"].lower() for e in content_entities}
    top_entities = await get_top_authority_entities_for_prompt(vertical, top_n)
    matched, missing = [], []
    for ent in top_entities:
        t = ent["text"].lower()
        if t in content_set:
            matched.append(ent["text"])
        else:
            missing.append(ent["text"])
    score = len(matched) / max(len(top_entities), 1) if top_entities else 0.0
    return {
        "matched_entities": matched,
        "missing_entities": missing,
        "authority_score": round(score, 4),
    }
