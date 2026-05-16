"""M1 — SERP collection router"""
from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.postgres import get_db
from models.db import Keyword, SerpResult
from models.schemas import (
    SerpCollectRequest, SerpCollectResponse,
    SerpResultsResponse, SerpResultItem, JobStatusResponse,
)

router = APIRouter(prefix="/api/v1/serp", tags=["SERP Collector"])


@router.post("/collect", response_model=SerpCollectResponse)
async def collect_serp(req: SerpCollectRequest, db: AsyncSession = Depends(get_db)):
    """Queue a SERP collection job for a keyword."""
    from tasks.celery_tasks import collect_serp_task
    job_id = str(uuid.uuid4())
    task = collect_serp_task.apply_async(
        args=[req.keyword_id, req.vertical, req.force_refresh],
        task_id=job_id,
    )
    return SerpCollectResponse(
        job_id=job_id,
        status="queued",
        message=f"SERP collection queued for keyword {req.keyword_id}",
    )


@router.get("/results/{keyword_id}", response_model=SerpResultsResponse)
async def get_serp_results(keyword_id: str, db: AsyncSession = Depends(get_db)):
    kw_result = await db.execute(select(Keyword).where(Keyword.id == keyword_id))
    kw = kw_result.scalar_one_or_none()
    if not kw:
        raise HTTPException(status_code=404, detail="Keyword not found")

    result = await db.execute(
        select(SerpResult).where(SerpResult.keyword_id == keyword_id)
        .order_by(SerpResult.position)
    )
    docs = result.scalars().all()

    return SerpResultsResponse(
        keyword_id=keyword_id,
        keyword_query=kw.query,
        results=[SerpResultItem.model_validate(d) for d in docs],
        collected_at=docs[0].collected_at if docs else None,
        total=len(docs),
    )


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    from tasks.celery_tasks import celery_app
    result = celery_app.AsyncResult(job_id)
    status_map = {
        "PENDING": "queued",
        "STARTED": "running",
        "SUCCESS": "done",
        "FAILURE": "failed",
    }
    return JobStatusResponse(
        job_id=job_id,
        status=status_map.get(result.status, "queued"),
        error=str(result.result) if result.status == "FAILURE" else None,
    )
