"""Initial migration — create all tables

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── keywords ──────────────────────────────────────────────────────────────
    op.create_table(
        "keywords",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("query", sa.Text, nullable=False),
        sa.Column("vertical", sa.String(100), nullable=False),
        sa.Column("funnel_stage", sa.String(10)),
        sa.Column("buyer_intent_score", sa.String(10)),
        sa.Column("intent_score_rationale", sa.Text),
        sa.Column("novelty_opportunity", sa.String(10)),
        sa.Column("novelty_rationale", sa.Text),
        sa.Column("priority_matrix", sa.String(50)),
        sa.Column("buyer_segment", sa.Text),
        sa.Column("recommended_next_action", sa.Text),
        sa.Column("query_cluster", sa.String(100)),
        sa.Column("intent_type", sa.String(50)),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_keywords_vertical", "keywords", ["vertical"])
    op.create_index("ix_keywords_query", "keywords", ["query"])

    # ── serp_results ──────────────────────────────────────────────────────────
    op.create_table(
        "serp_results",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("keyword_id", sa.String(36), sa.ForeignKey("keywords.id")),
        sa.Column("vertical", sa.String(100), nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("title", sa.Text),
        sa.Column("meta_description", sa.Text),
        sa.Column("body_content", sa.Text),
        sa.Column("word_count", sa.Integer),
        sa.Column("domain_rating", sa.Float, default=0.0),
        sa.Column("collected_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("content_hash", sa.String(64)),
        sa.UniqueConstraint("keyword_id", "position", name="uq_keyword_position"),
    )
    op.create_index("ix_serp_results_vertical", "serp_results", ["vertical"])
    op.create_index("ix_serp_results_hash", "serp_results", ["content_hash"])

    # ── entities ──────────────────────────────────────────────────────────────
    op.create_table(
        "entities",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("vertical", sa.String(100), nullable=False),
        sa.Column("frequency", sa.Integer, default=0),
        sa.Column("authority_score", sa.Float, default=0.0),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("text", "vertical", name="uq_entity_vertical"),
    )
    op.create_index("ix_entities_vertical", "entities", ["vertical"])

    # ── entity_occurrences ────────────────────────────────────────────────────
    op.create_table(
        "entity_occurrences",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("entity_id", sa.String(36), sa.ForeignKey("entities.id")),
        sa.Column("serp_result_id", sa.String(36), sa.ForeignKey("serp_results.id")),
        sa.Column("position_in_doc", sa.Integer),
        sa.Column("context_window", sa.Text),
        sa.Column("confidence", sa.Float, default=1.0),
    )

    # ── generation_jobs ───────────────────────────────────────────────────────
    op.create_table(
        "generation_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("keyword_id", sa.String(36), sa.ForeignKey("keywords.id"), nullable=True),
        sa.Column("keyword_text", sa.Text, nullable=False),
        sa.Column("vertical", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), default="queued"),
        sa.Column("celery_task_id", sa.String(200)),
        sa.Column("iterations_used", sa.Integer, default=0),
        sa.Column("final_novelty_score", sa.Float),
        sa.Column("predicted_position", sa.Integer),
        sa.Column("content", sa.Text),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime),
    )

    # ── novelty_history ───────────────────────────────────────────────────────
    op.create_table(
        "novelty_history",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("keyword_id", sa.String(36), sa.ForeignKey("keywords.id"), nullable=True),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("novelty_score", sa.Float, nullable=False),
        sa.Column("similarity_score", sa.Float),
        sa.Column("entity_novelty", sa.Float),
        sa.Column("relationship_novelty", sa.Float),
        sa.Column("semantic_diversity", sa.Float),
        sa.Column("passed", sa.Boolean, default=False),
        sa.Column("vertical", sa.String(100)),
        sa.Column("scored_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_novelty_history_hash", "novelty_history", ["content_hash"])

    # ── model_versions ────────────────────────────────────────────────────────
    op.create_table(
        "model_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("vertical", sa.String(100), nullable=False),
        sa.Column("model_type", sa.String(50), nullable=False),
        sa.Column("version_tag", sa.String(100), nullable=False),
        sa.Column("file_path", sa.Text, nullable=False),
        sa.Column("training_samples", sa.Integer),
        sa.Column("accuracy_score", sa.Float),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("trained_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("vertical", "version_tag", name="uq_model_version"),
    )


def downgrade() -> None:
    op.drop_table("model_versions")
    op.drop_table("novelty_history")
    op.drop_table("generation_jobs")
    op.drop_table("entity_occurrences")
    op.drop_table("entities")
    op.drop_table("serp_results")
    op.drop_table("keywords")
