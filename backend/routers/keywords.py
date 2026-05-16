"""Keywords router — full taxonomy CRUD + filter endpoints"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from db.postgres import get_db
from models.db import Keyword
from models.schemas import (
    KeywordListResponse,
    KeywordPriorityMatrixResponse,
    KeywordResponse,
    KeywordSummaryResponse,
)

router = APIRouter(prefix="/api/v1/keywords", tags=["Keywords"])


@router.get("", response_model=KeywordListResponse)
async def list_keywords(
    vertical: str | None = Query(None),
    funnel_stage: str | None = Query(None),
    buyer_intent: str | None = Query(None),
    novelty_opportunity: str | None = Query(None),
    priority_matrix: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    q = select(Keyword)
    if vertical:
        q = q.where(Keyword.vertical == vertical)
    if funnel_stage:
        q = q.where(Keyword.funnel_stage == funnel_stage)
    if buyer_intent:
        q = q.where(Keyword.buyer_intent_score == buyer_intent)
    if novelty_opportunity:
        q = q.where(Keyword.novelty_opportunity == novelty_opportunity)
    if priority_matrix:
        q = q.where(Keyword.priority_matrix == priority_matrix)

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0

    result = await db.execute(q.offset(offset).limit(limit))
    keywords = result.scalars().all()

    return KeywordListResponse(
        keywords=[KeywordResponse.model_validate(k) for k in keywords],
        total=total,
        filtered=len(keywords),
    )


@router.get("/summary", response_model=KeywordSummaryResponse)
async def get_summary(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Keyword))
    all_kw = result.scalars().all()

    by_vertical: dict[str, int] = {}
    by_funnel: dict[str, int] = {}
    by_intent: dict[str, int] = {}
    by_novelty: dict[str, int] = {}
    by_priority: dict[str, int] = {}

    for kw in all_kw:
        by_vertical[kw.vertical] = by_vertical.get(kw.vertical, 0) + 1
        if kw.funnel_stage:
            by_funnel[kw.funnel_stage] = by_funnel.get(kw.funnel_stage, 0) + 1
        if kw.buyer_intent_score:
            by_intent[kw.buyer_intent_score] = by_intent.get(kw.buyer_intent_score, 0) + 1
        if kw.novelty_opportunity:
            by_novelty[kw.novelty_opportunity] = by_novelty.get(kw.novelty_opportunity, 0) + 1
        if kw.priority_matrix:
            by_priority[kw.priority_matrix] = by_priority.get(kw.priority_matrix, 0) + 1

    return KeywordSummaryResponse(
        total=len(all_kw),
        by_vertical=by_vertical,
        by_funnel=by_funnel,
        by_intent=by_intent,
        by_novelty=by_novelty,
        by_priority_matrix=by_priority,
    )


@router.get("/priority-matrix", response_model=KeywordPriorityMatrixResponse)
async def get_priority_matrix(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Keyword))
    all_kw = result.scalars().all()

    matrix: dict[str, list] = {
        "sweet_spot": [], "high_priority": [], "authority_builder_plus": [],
        "standard_play": [], "hard_to_win": [], "authority_builder": [],
        "nurture_content": [], "deprioritize": [], "skip_defer": [],
    }
    pm_map = {
        "Sweet Spot": "sweet_spot",
        "High Priority": "high_priority",
        "Authority Builder+": "authority_builder_plus",
        "Standard Play": "standard_play",
        "Hard to Win": "hard_to_win",
        "Authority Builder": "authority_builder",
        "Nurture Content": "nurture_content",
        "Deprioritize": "deprioritize",
        "Skip/Defer": "skip_defer",
    }
    for kw in all_kw:
        key = pm_map.get(kw.priority_matrix or "", "standard_play")
        matrix[key].append(KeywordResponse.model_validate(kw))

    return KeywordPriorityMatrixResponse(**matrix)


@router.get("/{keyword_id}", response_model=KeywordResponse)
async def get_keyword(keyword_id: str, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    result = await db.execute(select(Keyword).where(Keyword.id == keyword_id))
    kw = result.scalar_one_or_none()
    if not kw:
        raise HTTPException(status_code=404, detail="Keyword not found")
    return KeywordResponse.model_validate(kw)
