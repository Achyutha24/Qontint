"""
Taxonomy Router — B2B Query Intelligence System
Additive module. Zero changes to existing routes/models.

Endpoints:
  POST /api/v1/taxonomy/ingest           — bulk upsert keyword records
  GET  /api/v1/taxonomy/sweet-spot       — High Intent + High Novelty queries
  POST /api/v1/taxonomy/pipeline-run     — run full analyze pipeline on a keyword
  GET  /api/v1/taxonomy/verticals        — per-vertical intelligence stats
  GET  /api/v1/taxonomy/opportunity-matrix — 4-quadrant scatter data
  GET  /api/v1/taxonomy/queries          — paginated + filterable query list
"""
from __future__ import annotations

import uuid
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from db.postgres import get_db
from models.db import Keyword, SerpResult, Entity
from models.schemas import KeywordResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/taxonomy", tags=["B2B Query Intelligence"])


# ── Intent / Novelty weight maps ─────────────────────────────────────────────
_INTENT_WEIGHT = {"High": 3.0, "Medium": 2.0, "Low": 1.0}
_NOVELTY_WEIGHT = {"High": 3.0, "Medium": 2.0, "Low": 1.0}
_NOVELTY_RANGE = {
    "Low":    (0.10, 0.30),
    "Medium": (0.30, 0.55),
    "High":   (0.55, 0.85),
}
_PRIORITY_MAP = {
    ("High", "High"):   "Strategic Targets",
    ("High", "Medium"): "Commercial",
    ("High", "Low"):    "Commercial",
    ("Medium", "High"): "Experimental",
    ("Medium", "Medium"): "Standard Play",
    ("Medium", "Low"):  "Deprioritize",
    ("Low", "High"):    "Experimental",
    ("Low", "Medium"):  "Low Value",
    ("Low", "Low"):     "Low Value",
}

VALID_VERTICALS = {
    "Accounting & Finance", "accounting_finance",
    "Banking & Lending", "banking_lending",
    "Investment & Wealth", "investment_wealth",
    "SAP & AI Supply Chain", "sap_supply_chain",
}

_VERTICAL_NORM = {
    "Accounting & Finance": "accounting_finance",
    "Banking & Lending": "banking_lending",
    "Investment & Wealth": "investment_wealth",
    "SAP & AI Supply Chain": "sap_supply_chain",
    "Accounting & Finance Ops": "accounting_finance",
    "Banking & Lending Ops": "banking_lending",
    "Investment & Wealth Tech": "investment_wealth",
    "SAP & AI Solutions in Supply Chain": "sap_supply_chain",
}


def _normalize_vertical(raw: str) -> str:
    """Normalize human-readable vertical names to DB keys."""
    return _VERTICAL_NORM.get(raw, raw)


def _opportunity_score(intent: str | None, novelty: str | None) -> float:
    i = _INTENT_WEIGHT.get(intent or "Low", 1.0)
    n = _NOVELTY_WEIGHT.get(novelty or "Low", 1.0)
    base_score = i * 0.5 + n * 0.5
    # Scale: 1 -> 35, 2 -> 65, 3 -> 95 (y = 30x + 5)
    return round(base_score * 30.0 + 5.0, 1)


def _novelty_calibrated(novelty_label: str | None) -> tuple[float, float]:
    return _NOVELTY_RANGE.get(novelty_label or "Low", (0.10, 0.30))


# ── Ingest schemas ────────────────────────────────────────────────────────────
class TaxonomyRecord(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    vertical: str
    funnel_stage: str | None = None
    buyer_intent_score: str | None = None
    novelty_opportunity: str | None = None
    priority_matrix: str | None = None
    buyer_segment: str | None = None
    notes: str | None = None
    query_cluster: str | None = None
    intent_type: str | None = None

    @field_validator("buyer_intent_score")
    @classmethod
    def validate_intent(cls, v: str | None) -> str | None:
        if v and v not in ("High", "Medium", "Low"):
            raise ValueError(f"buyer_intent_score must be High/Medium/Low, got: {v}")
        return v

    @field_validator("novelty_opportunity")
    @classmethod
    def validate_novelty(cls, v: str | None) -> str | None:
        if v and v not in ("High", "Medium", "Low"):
            raise ValueError(f"novelty_opportunity must be High/Medium/Low, got: {v}")
        return v

    @field_validator("funnel_stage")
    @classmethod
    def validate_funnel(cls, v: str | None) -> str | None:
        if v and v not in ("TOFU", "MOFU"):
            raise ValueError(f"funnel_stage must be TOFU/MOFU, got: {v}")
        return v


class IngestRequest(BaseModel):
    records: list[TaxonomyRecord] = Field(..., min_length=1, max_length=2000)


class IngestResponse(BaseModel):
    inserted: int
    updated: int
    skipped: int
    errors: list[str]
    total_processed: int


class SweetSpotQuery(BaseModel):
    id: str
    query: str
    vertical: str
    funnel_stage: str | None
    buyer_intent_score: str | None
    novelty_opportunity: str | None
    priority_matrix: str | None
    buyer_segment: str | None
    opportunity_score: float
    novelty_range_min: float
    novelty_range_max: float
    recommended_order: int


class SweetSpotResponse(BaseModel):
    queries: list[SweetSpotQuery]
    total: int


class PipelineRunRequest(BaseModel):
    keyword_id: str
    content: str = Field(
        default="",
        description="Optional seed content. If empty, the keyword query itself is used as stub content."
    )


class PipelineRunResponse(BaseModel):
    keyword_id: str
    keyword_query: str
    novelty_score: float
    novelty_calibrated_min: float
    novelty_calibrated_max: float
    passed: bool
    predicted_rank: int
    authority_score: float
    opportunity_score: float
    recommendations: list[str]
    processing_time_ms: int


class VerticalStats(BaseModel):
    vertical: str
    display_name: str
    total_queries: int
    sweet_spot_count: int
    high_intent_count: int
    high_novelty_count: int
    top_queries: list[str]
    avg_opportunity_score: float
    serp_result_count: int
    entity_count: int


class VerticalsResponse(BaseModel):
    verticals: list[VerticalStats]


class MatrixPoint(BaseModel):
    id: str
    query: str
    vertical: str
    buyer_intent: str
    novelty_opportunity: str
    opportunity_score: float
    quadrant: str
    funnel_stage: str | None


class OpportunityMatrixResponse(BaseModel):
    points: list[MatrixPoint]
    quadrant_counts: dict[str, int]
    total: int


class QueryListResponse(BaseModel):
    queries: list[KeywordResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Display name map ──────────────────────────────────────────────────────────
_DISPLAY_NAMES = {
    "accounting_finance": "Accounting & Finance",
    "banking_lending": "Banking & Lending",
    "investment_wealth": "Investment & Wealth",
    "sap_supply_chain": "SAP & AI Supply Chain",
}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/ingest", response_model=IngestResponse)
async def ingest_taxonomy(
    req: IngestRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Bulk upsert taxonomy records into the keywords table.
    Validates schema, normalizes verticals, auto-computes priority_matrix if missing.
    """
    inserted = updated = skipped = 0
    errors: list[str] = []

    for idx, rec in enumerate(req.records):
        try:
            normalized_vertical = _normalize_vertical(rec.vertical)

            # Auto-compute priority if not provided
            pm = rec.priority_matrix
            if not pm:
                pm = _PRIORITY_MAP.get(
                    (rec.buyer_intent_score or "Low", rec.novelty_opportunity or "Low"),
                    "Standard Play",
                )

            # Check if query already exists (case-insensitive)
            existing = await db.execute(
                select(Keyword).where(
                    func.lower(Keyword.query) == rec.query.lower(),
                    Keyword.vertical == normalized_vertical,
                )
            )
            kw = existing.scalar_one_or_none()

            if kw:
                # Update fields that may have changed
                kw.funnel_stage = rec.funnel_stage or kw.funnel_stage
                kw.buyer_intent_score = rec.buyer_intent_score or kw.buyer_intent_score
                kw.novelty_opportunity = rec.novelty_opportunity or kw.novelty_opportunity
                kw.priority_matrix = pm
                kw.buyer_segment = rec.buyer_segment or kw.buyer_segment
                kw.intent_score_rationale = rec.notes or kw.intent_score_rationale
                kw.query_cluster = rec.query_cluster or kw.query_cluster
                kw.intent_type = rec.intent_type or kw.intent_type
                updated += 1
            else:
                new_kw = Keyword(
                    id=str(uuid.uuid4()),
                    query=rec.query,
                    vertical=normalized_vertical,
                    funnel_stage=rec.funnel_stage,
                    buyer_intent_score=rec.buyer_intent_score,
                    novelty_opportunity=rec.novelty_opportunity,
                    priority_matrix=pm,
                    buyer_segment=rec.buyer_segment,
                    intent_score_rationale=rec.notes,
                    query_cluster=rec.query_cluster,
                    intent_type=rec.intent_type,
                )
                db.add(new_kw)
                inserted += 1

        except Exception as e:
            errors.append(f"Record {idx} ('{rec.query}'): {str(e)}")
            skipped += 1

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"DB commit failed: {str(e)}")

    return IngestResponse(
        inserted=inserted,
        updated=updated,
        skipped=skipped,
        errors=errors[:20],  # cap error list
        total_processed=len(req.records),
    )


@router.get("/sweet-spot", response_model=SweetSpotResponse)
async def get_sweet_spot_queries(
    vertical: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns High Intent + High Novelty queries ranked by opportunity score.
    Optional vertical filter.
    """
    q = select(Keyword).where(
        Keyword.buyer_intent_score == "High",
        Keyword.novelty_opportunity == "High",
    )
    if vertical:
        q = q.where(Keyword.vertical == vertical)

    result = await db.execute(q.limit(limit * 3))  # over-fetch for scoring
    all_kws = result.scalars().all()

    scored = []
    for kw in all_kws:
        score = _opportunity_score(kw.buyer_intent_score, kw.novelty_opportunity)
        nov_min, nov_max = _novelty_calibrated(kw.novelty_opportunity)
        scored.append((score, kw, nov_min, nov_max))

    # Sort descending by score
    scored.sort(key=lambda x: x[0], reverse=True)
    scored = scored[:limit]

    queries = [
        SweetSpotQuery(
            id=kw.id,
            query=kw.query,
            vertical=_DISPLAY_NAMES.get(kw.vertical, kw.vertical),
            funnel_stage=kw.funnel_stage,
            buyer_intent_score=kw.buyer_intent_score,
            novelty_opportunity=kw.novelty_opportunity,
            priority_matrix=kw.priority_matrix,
            buyer_segment=kw.buyer_segment,
            opportunity_score=score,
            novelty_range_min=nov_min,
            novelty_range_max=nov_max,
            recommended_order=idx + 1,
        )
        for idx, (score, kw, nov_min, nov_max) in enumerate(scored)
    ]

    return SweetSpotResponse(queries=queries, total=len(queries))


@router.post("/pipeline-run", response_model=PipelineRunResponse)
async def run_pipeline_for_keyword(
    req: PipelineRunRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Run the full analyze pipeline for an existing taxonomy keyword.
    Uses existing /api/v1/analyze logic via direct service call.
    """
    import time
    start = time.perf_counter()

    # Fetch keyword
    result = await db.execute(select(Keyword).where(Keyword.id == req.keyword_id))
    kw = result.scalar_one_or_none()
    if not kw:
        raise HTTPException(status_code=404, detail="Keyword not found")

    # Build content — use provided or synthesize from keyword query
    content = req.content.strip() if req.content.strip() else (
        f"This article covers {kw.query} in the context of {kw.vertical} vertical. "
        f"Key topics include AI automation, digital transformation, and enterprise workflow optimization."
    )

    try:
        from services.unified_analysis import run_unified_analysis
        unified = await run_unified_analysis(
            content=content,
            keyword=kw.query,
            vertical=kw.vertical,
            db=db,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")

    novelty = unified["novelty"]
    authority = unified["authority"]
    ranking = unified["ranking"]

    opp_score = _opportunity_score(kw.buyer_intent_score, kw.novelty_opportunity)
    nov_min, nov_max = _novelty_calibrated(kw.novelty_opportunity)

    recs: list[str] = []
    if not novelty["passed"]:
        missing = authority.get("missing_entities", [])
        if missing:
            recs.append(f"Add {len(missing)} high-authority entities: {', '.join(missing[:3])}")
    if novelty["novelty_score"] < nov_min:
        recs.append(f"Content novelty ({novelty['novelty_score']:.2f}) is below calibrated minimum ({nov_min}) for {kw.novelty_opportunity} novelty queries")
    if ranking["predicted_rank"] > 10:
        recs.append("Improve semantic coverage and entity density to target top-10 ranking")

    elapsed_ms = int((time.perf_counter() - start) * 1000)

    return PipelineRunResponse(
        keyword_id=kw.id,
        keyword_query=kw.query,
        novelty_score=novelty["novelty_score"],
        novelty_calibrated_min=nov_min,
        novelty_calibrated_max=nov_max,
        passed=novelty["passed"],
        predicted_rank=ranking["predicted_rank"],
        authority_score=authority["authority_score"],
        opportunity_score=opp_score,
        recommendations=recs,
        processing_time_ms=elapsed_ms,
    )


@router.get("/verticals", response_model=VerticalsResponse)
async def get_vertical_intelligence(db: AsyncSession = Depends(get_db)):
    """
    Per-vertical intelligence: query counts, opportunity stats, top queries, SERP/entity counts.
    """
    verticals_keys = ["accounting_finance", "banking_lending", "investment_wealth", "sap_supply_chain"]
    stats: list[VerticalStats] = []

    for vk in verticals_keys:
        # All queries for this vertical
        kw_res = await db.execute(select(Keyword).where(Keyword.vertical == vk))
        kws = kw_res.scalars().all()

        sweet_count = sum(1 for k in kws if k.buyer_intent_score == "High" and k.novelty_opportunity == "High")
        high_intent = sum(1 for k in kws if k.buyer_intent_score == "High")
        high_novelty = sum(1 for k in kws if k.novelty_opportunity == "High")

        avg_opp = (
            sum(_opportunity_score(k.buyer_intent_score, k.novelty_opportunity) for k in kws) / len(kws)
            if kws else 0.0
        )

        # Top 5 queries by opportunity score
        top_kws = sorted(kws, key=lambda k: _opportunity_score(k.buyer_intent_score, k.novelty_opportunity), reverse=True)
        top_queries = [k.query for k in top_kws[:5]]

        # SERP result count for vertical
        serp_count_res = await db.execute(
            select(func.count()).where(SerpResult.vertical == vk)
        )
        serp_count = serp_count_res.scalar() or 0

        # Entity count for vertical
        ent_count_res = await db.execute(
            select(func.count()).where(Entity.vertical == vk)
        )
        ent_count = ent_count_res.scalar() or 0

        stats.append(VerticalStats(
            vertical=vk,
            display_name=_DISPLAY_NAMES.get(vk, vk),
            total_queries=len(kws),
            sweet_spot_count=sweet_count,
            high_intent_count=high_intent,
            high_novelty_count=high_novelty,
            top_queries=top_queries,
            avg_opportunity_score=round(avg_opp, 3),
            serp_result_count=serp_count,
            entity_count=ent_count,
        ))

    return VerticalsResponse(verticals=stats)


@router.get("/opportunity-matrix", response_model=OpportunityMatrixResponse)
async def get_opportunity_matrix(
    vertical: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all keyword points for the 4-quadrant opportunity matrix visualization.
    """
    q = select(Keyword)
    if vertical:
        q = q.where(Keyword.vertical == vertical)

    result = await db.execute(q)
    all_kws = result.scalars().all()

    points: list[MatrixPoint] = []
    quadrant_counts: dict[str, int] = {
        "Strategic Targets": 0, "Commercial": 0, "Experimental": 0, "Low Value": 0,
        "Standard Play": 0, "Deprioritize": 0,
    }

    for kw in all_kws:
        intent = kw.buyer_intent_score or "Low"
        novelty = kw.novelty_opportunity or "Low"
        opp = _opportunity_score(intent, novelty)
        quadrant = _PRIORITY_MAP.get((intent, novelty), "Low Value")
        quadrant_counts[quadrant] = quadrant_counts.get(quadrant, 0) + 1

        points.append(MatrixPoint(
            id=kw.id,
            query=kw.query,
            vertical=_DISPLAY_NAMES.get(kw.vertical, kw.vertical),
            buyer_intent=intent,
            novelty_opportunity=novelty,
            opportunity_score=opp,
            quadrant=quadrant,
            funnel_stage=kw.funnel_stage,
        ))

    return OpportunityMatrixResponse(
        points=points,
        quadrant_counts=quadrant_counts,
        total=len(points),
    )


@router.get("/queries", response_model=QueryListResponse)
async def list_taxonomy_queries(
    vertical: str | None = Query(None),
    funnel_stage: str | None = Query(None),
    buyer_intent: str | None = Query(None),
    novelty_opportunity: str | None = Query(None),
    priority_matrix: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=2000),
    db: AsyncSession = Depends(get_db),
):
    """
    Paginated + filterable query list for the Query Intelligence Explorer.
    """
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
    if search:
        q = q.where(Keyword.query.ilike(f"%{search}%"))

    total_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_res.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(q.order_by(Keyword.created_at.desc()).offset(offset).limit(page_size))
    kws = result.scalars().all()

    res_queries = []
    for k in kws:
        kw_resp = KeywordResponse.model_validate(k)
        kw_resp.opportunity_score = _opportunity_score(k.buyer_intent_score, k.novelty_opportunity)
        res_queries.append(kw_resp)

    return QueryListResponse(
        queries=res_queries,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size),
    )
