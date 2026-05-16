"""
Qontint Backend — FastAPI Application Entry Point
M7: API Gateway for all intelligence modules

Simplified Stack:
  - LLM: Mocked (Zero dependency)
  - SERP: DuckDuckGo + httpx scraper
  - NLP: spaCy en_core_web_lg
  - Graph: Mocked (In-memory)
  - Cache: In-memory dictionary
  - DB: SQLite

Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.postgres import get_db
from db.neo4j_client import ensure_indexes, close_driver
from db.redis_client import close_redis
from middleware.cors import CORS_CONFIG
from middleware.rate_limiter import limiter
from models.schemas import (
    AnalyzeRequest, AnalyzeResponse, Recommendation,
    NoveltyScoreResponse, RankingPredictResponse, AuthorityCoverageResponse,
)

# ── Routers ───────────────────────────────────────────────────────────────────
from routers import health, keywords, serp, entities, graph, novelty, authority, ranking, generation, slm, dashboard, youtube, taxonomy

logger = logging.getLogger(__name__)


# ── Lifespan: startup/shutdown ────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Qontint API starting up (SIMPLIFIED MODE)...")

    # Pre-load NLP / ML models so first analyze is fast
    try:
        from analysis.entities import get_nlp
        get_nlp()
        logger.info("✅ spaCy model loaded")
    except Exception as exc:
        logger.warning("⚠️  spaCy model load failed: %s", exc)

    try:
        from analysis.semantic import get_embedding_model
        get_embedding_model()
        logger.info("✅ Sentence-transformers model loaded")
    except Exception as exc:
        logger.warning("⚠️  Embedding model load failed: %s", exc)

    try:
        from analysis.serp import warmup_rank_model
        warmup_rank_model()
        logger.info("✅ Ranking model warmed up")
    except Exception as exc:
        logger.warning("⚠️  Ranking model warmup failed: %s", exc)

    # Ensure Mock Neo4j indexes (does nothing in mock)
    try:
        await ensure_indexes()
        logger.info("✅ Mock indexes initialized")
    except Exception as exc:
        logger.warning("⚠️  Mock initialization failed: %s", exc)

    logger.info("✅ Qontint API ready — docs at http://localhost:8000/docs")
    yield

    # Shutdown cleanup
    await close_driver()
    await close_redis()
    logger.info("👋 Qontint API shutdown complete")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Qontint Intelligence Engine (Simple)",
    description=(
        "Semantic Authority Operating System — B2B Fintech Content Intelligence.\n\n"
        "**Zero-Dependency Stack**: Mock LLM · spaCy NLP · In-memory Graph · SQLite\n\n"
        "No Docker or external services required."
    ),
    version="1.0.0-simple",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Rate limiting ─────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(CORSMiddleware, **CORS_CONFIG)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(keywords.router)
app.include_router(serp.router)
app.include_router(entities.router)
app.include_router(graph.router)
app.include_router(novelty.router)
app.include_router(authority.router)
app.include_router(ranking.router)
app.include_router(generation.router)
app.include_router(slm.router)
app.include_router(dashboard.router)
app.include_router(youtube.router)
app.include_router(taxonomy.router)


# ── Core Pipeline Endpoint: POST /api/v1/analyze ──────────────────────────────
@app.post(
    "/api/v1/analyze",
    response_model=AnalyzeResponse,
    tags=["Core Pipeline"],
    summary="Full content analysis — novelty + authority + ranking (<10s)",
)
async def analyze_content(req: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    """
    M7 Core Pipeline: Runs M2 + M4 + M5 + M6 in parallel.
    """
    total_start = time.perf_counter()

    # ── Unified SERP-grounded scoring (M2+M4+M5+M6 single pass) ─────────────
    from services.unified_analysis import run_unified_analysis

    unified = await run_unified_analysis(
        content=req.content,
        keyword=req.keyword,
        vertical=req.vertical,
        db=db,
    )
    novelty_result = unified["novelty"]
    authority_result = unified["authority"]
    ranking_result = unified["ranking"]

    # ── Generate recommendations ──────────────────────────────────────────────
    recommendations: list[Recommendation] = []
    if not novelty_result["passed"]:
        missing = authority_result.get("missing_entities", [])
        if missing:
            recommendations.append(Recommendation(
                type="add_entity",
                description=f"Add {len(missing)} high-authority entities to increase novelty score",
                suggested_entities=missing[:5],
                priority="High",
            ))

    total_ms = unified.get("total_processing_time_ms") or int((time.perf_counter() - total_start) * 1000)

    return AnalyzeResponse(
        novelty=NoveltyScoreResponse(**novelty_result),
        ranking=RankingPredictResponse(**ranking_result),
        authority=AuthorityCoverageResponse(**authority_result),
        recommendations=recommendations,
        total_processing_time_ms=total_ms,
        loop_required=not novelty_result["passed"],
    )


# ── Root redirect ─────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    return JSONResponse({
        "name": "Qontint Intelligence Engine (Simple)",
        "version": "1.0.0-simple",
        "docs": "/docs",
        "health": "/health",
        "stack": {
            "llm": "Gemini API",
            "serp": "DuckDuckGo + httpx",
            "nlp": "spaCy en_core_web_lg",
            "graph": "SQLite Graph Projection",
            "cache": "In-memory dict",
            "db": "SQLite",
        }
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
