"""Health check router — GET /health and GET /api/v1/metrics"""
from __future__ import annotations

import time
from datetime import datetime

from fastapi import APIRouter
from sqlalchemy import func, select, text

from db.postgres import check_db_health, AsyncSessionLocal
from db.neo4j_client import check_neo4j_health
from db.redis_client import check_redis_health
from models.schemas import HealthResponse, MetricsResponse, ServiceHealth
from models.db import Keyword, SerpResult, Entity, GenerationJob, NoveltyHistory
from config import settings

router = APIRouter(tags=["Health"])
_start_time = time.time()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    t0 = time.perf_counter()
    pg_ok = await check_db_health()
    pg_ms = (time.perf_counter() - t0) * 1000

    t1 = time.perf_counter()
    neo_ok = await check_neo4j_health()
    neo_ms = (time.perf_counter() - t1) * 1000

    t2 = time.perf_counter()
    redis_ok = await check_redis_health()
    redis_ms = (time.perf_counter() - t2) * 1000

    services = [
        ServiceHealth(name="postgres", status="healthy" if pg_ok else "down", latency_ms=round(pg_ms, 1)),
        ServiceHealth(name="neo4j", status="healthy" if neo_ok else "down", latency_ms=round(neo_ms, 1)),
        ServiceHealth(name="redis", status="healthy" if redis_ok else "down", latency_ms=round(redis_ms, 1)),
        ServiceHealth(name="ollama", status="healthy", details="model: Mocked (Simple Mode)"),
    ]

    all_ok = pg_ok and redis_ok
    return HealthResponse(
        status="healthy" if all_ok else "degraded",
        environment=settings.ENVIRONMENT,
        services=services,
        uptime_seconds=round(time.time() - _start_time, 1),
    )


@router.get("/api/v1/metrics", response_model=MetricsResponse)
async def get_metrics():
    async with AsyncSessionLocal() as db:
        kw_count = (await db.execute(select(func.count(Keyword.id)))).scalar() or 0
        serp_count = (await db.execute(select(func.count(SerpResult.id)))).scalar() or 0
        ent_count = (await db.execute(select(func.count(Entity.id)))).scalar() or 0
        job_count = (await db.execute(select(func.count(GenerationJob.id)))).scalar() or 0
        avg_novelty_result = await db.execute(select(func.avg(NoveltyHistory.novelty_score)))
        avg_novelty = float(avg_novelty_result.scalar() or 0.0)

    return MetricsResponse(
        total_keywords=kw_count,
        total_serp_results=serp_count,
        total_entities=ent_count,
        total_generation_jobs=job_count,
        cache_hit_rate=0.0,
        avg_novelty_score=round(avg_novelty, 4),
        avg_processing_time_ms=0.0,
    )
