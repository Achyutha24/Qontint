"""
Seed data loader — loads keywords_seed.json into PostgreSQL on first deployment.
Run: python data/load_seed_data.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from config import settings
from models.db import Base, Keyword


async def load_keywords(db: AsyncSession, seed_file: Path) -> int:
    data = json.loads(seed_file.read_text(encoding="utf-8"))
    keywords = data.get("keywords", [])

    loaded = 0
    for kw_data in keywords:
        # Skip if already exists (idempotent)
        existing = await db.execute(
            select(Keyword).where(
                Keyword.query == kw_data["query"],
                Keyword.vertical == kw_data["vertical"],
            )
        )
        if existing.scalar_one_or_none():
            continue

        kw = Keyword(
            id=str(uuid.uuid4()),
            query=kw_data["query"],
            vertical=kw_data["vertical"],
            funnel_stage=kw_data.get("funnel_stage"),
            buyer_intent_score=kw_data.get("buyer_intent_score"),
            intent_score_rationale=kw_data.get("intent_score_rationale"),
            novelty_opportunity=kw_data.get("novelty_opportunity"),
            novelty_rationale=kw_data.get("novelty_rationale"),
            priority_matrix=kw_data.get("priority_matrix"),
            buyer_segment=kw_data.get("buyer_segment"),
            recommended_next_action=kw_data.get("recommended_next_action"),
            query_cluster=kw_data.get("query_cluster"),
            intent_type=kw_data.get("intent_type"),
        )
        db.add(kw)
        loaded += 1

    await db.commit()
    return loaded


async def main():
    seed_file = Path(__file__).parent / "keywords_seed.json"
    if not seed_file.exists():
        print(f"❌ Seed file not found: {seed_file}")
        sys.exit(1)

    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with session_factory() as db:
        loaded = await load_keywords(db, seed_file)
        print(f"✅ Loaded {loaded} keywords from seed data")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
