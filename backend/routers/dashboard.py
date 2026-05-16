from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from db.postgres import get_db
from models.db import NoveltyHistory, Keyword, Entity

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])

@router.get("/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    # Novelty history: latest 10 scores
    res_nov = await db.execute(
        select(NoveltyHistory.scored_at, NoveltyHistory.novelty_score)
        .order_by(desc(NoveltyHistory.scored_at))
        .limit(10)
    )
    novelty_rows = res_nov.all()
    novelty_history = []
    for r in reversed(novelty_rows):
        novelty_history.append({
            "time": r.scored_at.strftime("%H:%M") if r.scored_at else "00:00",
            "score": round(r.novelty_score, 2)
        })
    if not novelty_history:
        novelty_history = [{"time": "N/A", "score": 0.0}]

    # Vertical info
    res_vert = await db.execute(
        select(Keyword.vertical, func.count(Keyword.id))
        .group_by(Keyword.vertical)
    )
    vert_counts = {r[0]: r[1] for r in res_vert.all()}
    
    vertical_info = [
        {"key": "accounting_finance", "label": "Accounting & Finance", "kw": vert_counts.get("accounting_finance", 0)},
        {"key": "banking_lending", "label": "Banking & Lending", "kw": vert_counts.get("banking_lending", 0)},
        {"key": "investment_wealth", "label": "Investment & Wealth", "kw": vert_counts.get("investment_wealth", 0)},
        {"key": "sap_supply_chain", "label": "SAP & Supply Chain", "kw": vert_counts.get("sap_supply_chain", 0)},
    ]

    # Radar data (real averages based on history)
    avg_nov = await db.execute(select(func.avg(NoveltyHistory.novelty_score)))
    avg_ent = await db.execute(select(func.avg(NoveltyHistory.entity_novelty)))
    avg_rel = await db.execute(select(func.avg(NoveltyHistory.relationship_novelty)))
    avg_sem = await db.execute(select(func.avg(NoveltyHistory.semantic_diversity)))
    
    avg_nov_val = avg_nov.scalar() or 0.5
    avg_ent_val = avg_ent.scalar() or 0.5
    avg_rel_val = avg_rel.scalar() or 0.5
    avg_sem_val = avg_sem.scalar() or 0.5

    radar_data = [
        {"metric": "Entity Novelty", "value": round(avg_ent_val * 100)},
        {"metric": "Semantic Diversity", "value": round(avg_sem_val * 100)},
        {"metric": "Relationship Novelty", "value": round(avg_rel_val * 100)},
        {"metric": "Overall Novelty", "value": round(avg_nov_val * 100)},
        {"metric": "Topical Health", "value": round(((avg_ent_val + avg_sem_val) / 2) * 100)},
    ]

    return {
        "noveltyHistory": novelty_history,
        "radarData": radar_data,
        "verticalInfo": vertical_info,
    }
