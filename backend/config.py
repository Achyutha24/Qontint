"""
Application settings loaded from environment variables via pydantic-settings.
"""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── App ─────────────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    API_SECRET_KEY: str = "change_me_in_production_use_32chars"
    ALLOWED_ORIGINS: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"]
    )

    # ── SQLite ───────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./qontint.db"

    # ── Mocks (Originals Removed) ─────────────────────────────────────────
    # Removed Neo4j, Redis, Ollama, Celery configs for simple mode

    # ── Gemini API (AI Content) ─────────────────────────────────────────────
    GOOGLE_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-flash-latest"
    GEMINI_TIMEOUT: int = 120

    # ── SERP Scraper ──────────────────────────────────────────────────────────
    SCRAPER_DELAY_MS: int = 0
    SCRAPER_MAX_RESULTS: int = 5
    SCRAPER_HEADLESS: bool = True
    SCRAPER_PROXY_URL: str | None = None

    # ── Analyze fast-path (target <20s end-to-end) ────────────────────────────
    ANALYZE_SERP_MAX_RESULTS: int = 3
    ANALYZE_SERP_TIMEOUT_MS: int = 5_000
    ANALYZE_SERP_BODY_MAX_CHARS: int = 8_000
    ANALYZE_MAX_SERP_DOCS: int = 5
    ANALYZE_NLP_MAX_LEN: int = 1_500
    ANALYZE_CORPUS_SNIPPET_CHARS: int = 800

    # ── ML ────────────────────────────────────────────────────────────────────
    ML_MODELS_DIR: str = "./ml_models"
    MODEL_RETRAIN_INTERVAL_DAYS: int = 7

    # ── Cache TTLs ────────────────────────────────────────────────────────────
    CACHE_NOVELTY_TTL: int = 3600
    CACHE_AUTHORITY_TTL: int = 86400
    CACHE_RANKING_TTL: int = 3600

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_SERP: str = "10/minute"
    RATE_LIMIT_GENERATE: str = "5/minute"


settings = Settings()
