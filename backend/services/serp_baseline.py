"""Load and ensure SERP competitor baseline for scoring."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.db import Keyword, SerpResult
from services.serp_collector import collect_serp_for_keyword

logger = logging.getLogger(__name__)


async def ensure_keyword_and_serp(
    keyword: str,
    vertical: str,
    db: AsyncSession,
    *,
    fast_mode: bool = True,
) -> tuple[Any, list[SerpResult]]:
    """Ensure keyword exists and SERP rows are available; returns (keyword, serp_docs).

    Optimization: if the vertical already has sufficient SERP data from other keywords,
    use that as a baseline instead of triggering a slow new collection for every new keyword.
    """
    kw_result = await db.execute(
        select(Keyword).where(Keyword.query == keyword, Keyword.vertical == vertical)
    )
    kw_obj = kw_result.scalar_one_or_none()

    if not kw_obj:
        kw_obj = Keyword(query=keyword, vertical=vertical)
        db.add(kw_obj)
        await db.commit()
        await db.refresh(kw_obj)

    count_res = await db.execute(
        select(func.count(SerpResult.id)).where(SerpResult.keyword_id == kw_obj.id)
    )
    serp_count = count_res.scalar() or 0

    min_required = settings.ANALYZE_SERP_MAX_RESULTS

    if serp_count < min_required:
        # Before triggering expensive collection, check if vertical has enough fallback data
        vertical_count_res = await db.execute(
            select(func.count(SerpResult.id)).where(SerpResult.vertical == vertical)
        )
        vertical_count = vertical_count_res.scalar() or 0

        if vertical_count >= min_required * 2:
            # Vertical has enough data — skip collection, use fallback directly
            logger.info(
                "Skipping SERP collection for '%s' — vertical '%s' has %d docs available",
                keyword, vertical, vertical_count,
            )
        else:
            logger.info("Collecting SERP baseline for '%s' (had %d rows)", keyword, serp_count)
            await collect_serp_for_keyword(kw_obj.id, vertical, db, fast_mode=fast_mode)

    serp_res = await db.execute(
        select(SerpResult)
        .where(SerpResult.keyword_id == kw_obj.id)
        .order_by(SerpResult.position.asc())
        .limit(settings.ANALYZE_MAX_SERP_DOCS)
    )
    serp_docs = list(serp_res.scalars().all())

    if len(serp_docs) < min_required:
        logger.debug("Keyword SERP thin (%d), adding vertical fallback", len(serp_docs))
        fallback = await db.execute(
            select(SerpResult)
            .where(SerpResult.vertical == vertical)
            .order_by(SerpResult.collected_at.desc())
            .limit(settings.ANALYZE_MAX_SERP_DOCS)
        )
        seen_urls = {d.url for d in serp_docs}
        for row in fallback.scalars().all():
            if row.url not in seen_urls:
                serp_docs.append(row)
                seen_urls.add(row.url)
            if len(serp_docs) >= settings.ANALYZE_MAX_SERP_DOCS:
                break

    return kw_obj, serp_docs
