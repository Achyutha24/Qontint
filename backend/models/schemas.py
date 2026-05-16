"""
Pydantic v2 schemas for all API request/response models.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


# ── Enums / Literals ──────────────────────────────────────────────────────────
VerticalType = Literal[
    "accounting_finance",
    "banking_lending",
    "investment_wealth",
    "sap_supply_chain",
]
FunnelStage = Literal["TOFU", "MOFU"]
IntentScore = Literal["High", "Medium", "Low"]
NoveltyOpportunity = Literal["High", "Medium", "Low"]
JobStatus = Literal["queued", "running", "done", "failed"]


# ─────────────────────────────────────────────────────────────────────────────
# KEYWORD SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class KeywordBase(BaseModel):
    query: str
    vertical: str  # relaxed from VerticalType so stored rows with any vertical can be read
    funnel_stage: FunnelStage | None = None
    buyer_intent_score: IntentScore | None = None
    intent_score_rationale: str | None = None
    novelty_opportunity: NoveltyOpportunity | None = None
    novelty_rationale: str | None = None
    priority_matrix: str | None = None
    buyer_segment: str | None = None
    recommended_next_action: str | None = None
    query_cluster: str | None = None
    intent_type: str | None = None


class KeywordResponse(KeywordBase):
    id: str
    created_at: datetime
    opportunity_score: float | None = None

    model_config = {"from_attributes": True}


class KeywordListResponse(BaseModel):
    keywords: list[KeywordResponse]
    total: int
    filtered: int


class KeywordSummaryResponse(BaseModel):
    total: int
    by_vertical: dict[str, int]
    by_funnel: dict[str, int]
    by_intent: dict[str, int]
    by_novelty: dict[str, int]
    by_priority_matrix: dict[str, int]


class KeywordPriorityMatrixResponse(BaseModel):
    sweet_spot: list[KeywordResponse]
    high_priority: list[KeywordResponse]
    authority_builder_plus: list[KeywordResponse]
    standard_play: list[KeywordResponse]
    hard_to_win: list[KeywordResponse]
    authority_builder: list[KeywordResponse]
    nurture_content: list[KeywordResponse]
    deprioritize: list[KeywordResponse]
    skip_defer: list[KeywordResponse]


# ─────────────────────────────────────────────────────────────────────────────
# SERP SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class SerpCollectRequest(BaseModel):
    keyword_id: str
    vertical: VerticalType
    force_refresh: bool = False


class SerpCollectResponse(BaseModel):
    job_id: str
    status: JobStatus = "queued"
    message: str


class SerpResultItem(BaseModel):
    id: str
    position: int
    url: str
    title: str | None
    meta_description: str | None
    word_count: int | None
    domain_rating: float
    collected_at: datetime

    model_config = {"from_attributes": True}


class SerpResultsResponse(BaseModel):
    keyword_id: str
    keyword_query: str
    results: list[SerpResultItem]
    collected_at: datetime | None
    total: int


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: float = 0.0
    eta_seconds: int | None = None
    error: str | None = None


# ─────────────────────────────────────────────────────────────────────────────
# ENTITY SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class EntityItem(BaseModel):
    id: str | None = None
    text: str
    entity_type: str
    confidence: float = 1.0
    authority_score: float = 0.0


class EntityExtractRequest(BaseModel):
    content: str = Field(..., min_length=10, max_length=100_000)
    vertical: VerticalType


class EntityExtractResponse(BaseModel):
    entities: list[EntityItem]
    total: int
    processing_time_ms: int


class VerticalEntitiesResponse(BaseModel):
    vertical: str
    entities: list[EntityItem]
    total: int


# ─────────────────────────────────────────────────────────────────────────────
# GRAPH SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class GraphBuildRequest(BaseModel):
    vertical: VerticalType


class GraphBuildResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str


class EntityNeighbor(BaseModel):
    entity: EntityItem
    weight: float
    relationship: str


class EntityNeighborsResponse(BaseModel):
    entity: EntityItem
    neighbors: list[EntityNeighbor]
    depth: int
    total: int


class AuthorityTopResponse(BaseModel):
    vertical: str
    entities: list[EntityItem]
    total: int


# ─────────────────────────────────────────────────────────────────────────────
# NOVELTY SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class NoveltyScoreRequest(BaseModel):
    content: str = Field(..., min_length=50, max_length=100_000)
    keyword: str
    vertical: VerticalType


class NoveltyScoreResponse(BaseModel):
    novelty_score: float
    similarity_score: float
    entity_novelty: float
    relationship_novelty: float
    semantic_diversity: float
    passed: bool
    threshold: float = 0.35
    verdict: str
    processing_time_ms: int
    reasoning: list[str] = []


# ─────────────────────────────────────────────────────────────────────────────
# AUTHORITY SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class AuthorityCoverageRequest(BaseModel):
    content: str = Field(..., min_length=10)
    vertical: VerticalType
    top_n: int = Field(default=20, ge=5, le=100)


class AuthorityCoverageResponse(BaseModel):
    matched_entities: list[str]
    missing_entities: list[str]
    authority_score: float


# ─────────────────────────────────────────────────────────────────────────────
# RANKING SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class RankingPredictRequest(BaseModel):
    content: str = Field(..., min_length=50)
    novelty_score: float = Field(ge=0.0, le=1.0)
    entity_coverage: float = Field(ge=0.0, le=1.0)
    vertical: VerticalType
    keyword: str


class RankingPredictResponse(BaseModel):
    predicted_rank: int
    confidence: float
    ranking_factors: dict[str, float]
    optimization_gaps: list[str] = []
    model_version: str
    processing_time_ms: int


class RankingTrainRequest(BaseModel):
    force_retrain: bool = False


class RankingTrainResponse(BaseModel):
    job_id: str
    status: JobStatus
    training_samples: int


# ─────────────────────────────────────────────────────────────────────────────
# GENERATION SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    keyword: str = Field(..., min_length=2, max_length=200)
    vertical: VerticalType
    max_iterations: int = Field(default=5, ge=1, le=10)
    novelty_threshold: float = Field(default=0.35, ge=0.1, le=1.0)


class GenerateResponse(BaseModel):
    content: str
    novelty_score: float
    predicted_position: int | None
    iterations_used: int
    success: bool
    entity_coverage: float
    job_id: str
    processing_time_ms: int


# ─────────────────────────────────────────────────────────────────────────────
# ANALYZE PIPELINE SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class Recommendation(BaseModel):
    type: str  # "add_entity" | "add_relationship" | "improve_coverage"
    description: str
    suggested_entities: list[str] = []
    priority: str  # "High" | "Medium" | "Low"


class AnalyzeRequest(BaseModel):
    content: str = Field(..., min_length=50, max_length=100_000)
    keyword: str
    vertical: VerticalType


class AnalyzeResponse(BaseModel):
    novelty: NoveltyScoreResponse
    ranking: RankingPredictResponse
    authority: AuthorityCoverageResponse
    recommendations: list[Recommendation]
    total_processing_time_ms: int
    loop_required: bool


# ─────────────────────────────────────────────────────────────────────────────
# SLM SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class SLMVerticalInfo(BaseModel):
    name: str
    vertical_key: str
    status: str  # "mvp_in_progress" | "planned" | "active"
    entity_count: int
    training_samples: int
    description: str


class SLMVerticalsResponse(BaseModel):
    verticals: list[SLMVerticalInfo]


class SLMGenerateRequest(BaseModel):
    keyword: str
    max_iterations: int = Field(default=5, ge=1, le=10)


class SLMGenerateResponse(BaseModel):
    content: str
    novelty_score: float
    vertical_specific_entities_used: int
    iterations_used: int
    success: bool


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class ServiceHealth(BaseModel):
    name: str
    status: str  # "healthy" | "degraded" | "down"
    latency_ms: float | None = None
    details: str | None = None


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    environment: str
    services: list[ServiceHealth]
    uptime_seconds: float


class MetricsResponse(BaseModel):
    total_keywords: int
    total_serp_results: int
    total_entities: int
    total_generation_jobs: int
    cache_hit_rate: float
    avg_novelty_score: float
    avg_processing_time_ms: float
