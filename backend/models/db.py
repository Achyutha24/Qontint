"""
SQLAlchemy ORM models for all PostgreSQL tables.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
# from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ── Keywords ──────────────────────────────────────────────────────────────────
class Keyword(Base):
    __tablename__ = "keywords"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    query = Column(Text, nullable=False, index=True)
    vertical = Column(String(100), nullable=False, index=True)
    funnel_stage = Column(String(10))           # TOFU / MOFU
    buyer_intent_score = Column(String(10))     # High / Medium / Low
    intent_score_rationale = Column(Text)
    novelty_opportunity = Column(String(10))    # High / Medium / Low
    novelty_rationale = Column(Text)
    priority_matrix = Column(String(50))
    buyer_segment = Column(Text)
    recommended_next_action = Column(Text)
    query_cluster = Column(String(100))
    intent_type = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    serp_results = relationship("SerpResult", back_populates="keyword")
    novelty_history = relationship("NoveltyHistory", back_populates="keyword")


# ── SERP Results ──────────────────────────────────────────────────────────────
class SerpResult(Base):
    __tablename__ = "serp_results"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    keyword_id = Column(String(36), ForeignKey("keywords.id"), nullable=False)
    vertical = Column(String(100), nullable=False, index=True)
    position = Column(Integer, nullable=False)
    url = Column(Text, nullable=False)
    title = Column(Text)
    meta_description = Column(Text)
    body_content = Column(Text)
    word_count = Column(Integer)
    domain_rating = Column(Float, default=0.0)  # Estimated, not Ahrefs
    collected_at = Column(DateTime, server_default=func.now())
    content_hash = Column(String(64), index=True)  # SHA-256 for dedup

    # Relationships
    keyword = relationship("Keyword", back_populates="serp_results")
    entity_occurrences = relationship("EntityOccurrence", back_populates="serp_result")

    __table_args__ = (
        UniqueConstraint("keyword_id", "position", name="uq_keyword_position"),
    )


# ── Entities ──────────────────────────────────────────────────────────────────
class Entity(Base):
    __tablename__ = "entities"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    text = Column(Text, nullable=False)
    entity_type = Column(String(50), nullable=False)   # ORG, PRODUCT, CONCEPT, etc.
    vertical = Column(String(100), nullable=False, index=True)
    frequency = Column(Integer, default=0)
    authority_score = Column(Float, default=0.0)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    entity_occurrences = relationship("EntityOccurrence", back_populates="entity")

    __table_args__ = (
        UniqueConstraint("text", "vertical", name="uq_entity_vertical"),
    )


# ── Entity Occurrences ────────────────────────────────────────────────────────
class EntityOccurrence(Base):
    __tablename__ = "entity_occurrences"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    entity_id = Column(String(36), ForeignKey("entities.id"), nullable=False)
    serp_result_id = Column(String(36), ForeignKey("serp_results.id"), nullable=False)
    position_in_doc = Column(Integer)
    context_window = Column(Text)
    confidence = Column(Float, default=1.0)

    # Relationships
    entity = relationship("Entity", back_populates="entity_occurrences")
    serp_result = relationship("SerpResult", back_populates="entity_occurrences")


# ── Generation Jobs ───────────────────────────────────────────────────────────
class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    keyword_id = Column(String(36), ForeignKey("keywords.id"), nullable=True)
    keyword_text = Column(Text, nullable=False)
    vertical = Column(String(100), nullable=False)
    status = Column(String(20), default="queued")  # queued/running/done/failed
    celery_task_id = Column(String(200))
    iterations_used = Column(Integer, default=0)
    final_novelty_score = Column(Float)
    predicted_position = Column(Integer)
    content = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)


# ── Novelty History ───────────────────────────────────────────────────────────
class NoveltyHistory(Base):
    __tablename__ = "novelty_history"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    keyword_id = Column(String(36), ForeignKey("keywords.id"), nullable=True)
    content_hash = Column(String(64), nullable=False, index=True)
    novelty_score = Column(Float, nullable=False)
    similarity_score = Column(Float)
    entity_novelty = Column(Float)
    relationship_novelty = Column(Float)
    semantic_diversity = Column(Float)
    passed = Column(Boolean, default=False)
    vertical = Column(String(100))
    scored_at = Column(DateTime, server_default=func.now())

    keyword = relationship("Keyword", back_populates="novelty_history")


# ── ML Model Versions ─────────────────────────────────────────────────────────
class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    vertical = Column(String(100), nullable=False)
    model_type = Column(String(50), nullable=False)  # gradient_boosting / etc.
    version_tag = Column(String(100), nullable=False)
    file_path = Column(Text, nullable=False)
    training_samples = Column(Integer)
    accuracy_score = Column(Float)
    is_active = Column(Boolean, default=True)
    trained_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("vertical", "version_tag", name="uq_model_version"),
    )
