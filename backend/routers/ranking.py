"""M6 — Ranking prediction router"""
from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from db.postgres import get_db
from models.schemas import (
    RankingPredictRequest, RankingPredictResponse,
    RankingTrainRequest, RankingTrainResponse,
)
from services.ranking_predictor import predict_ranking, train_ranking_model

router = APIRouter(prefix="/api/v1/ranking", tags=["Ranking Predictor"])


@router.post("/predict", response_model=RankingPredictResponse)
async def predict_rank(req: RankingPredictRequest, db: AsyncSession = Depends(get_db)):
    result = await predict_ranking(
        content=req.content,
        vertical=req.vertical,
        novelty_score=req.novelty_score,
        entity_coverage=req.entity_coverage,
        db=db,
    )
    return RankingPredictResponse(**result)


@router.post("/train/{vertical}", response_model=RankingTrainResponse)
async def train_model(
    vertical: str,
    req: RankingTrainRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, func
    from models.db import SerpResult

    count_result = await db.execute(
        select(func.count(SerpResult.id)).where(SerpResult.vertical == vertical)
    )
    sample_count = count_result.scalar() or 0

    job_id = str(uuid.uuid4())

    # Run training in background (no Celery needed)
    async def _train():
        from db.postgres import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await train_ranking_model(vertical, session, req.force_retrain)

    background_tasks.add_task(_train)

    return RankingTrainResponse(
        job_id=job_id, status="queued", training_samples=sample_count
    )
