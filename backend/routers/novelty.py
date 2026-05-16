"""M4 — Novelty scoring router"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.postgres import get_db
from models.schemas import NoveltyScoreRequest, NoveltyScoreResponse
from services.novelty_scorer import compute_novelty_score

router = APIRouter(prefix="/api/v1/novelty", tags=["Novelty Scorer"])


@router.post("/score", response_model=NoveltyScoreResponse)
async def score_novelty(req: NoveltyScoreRequest, db: AsyncSession = Depends(get_db)):
    result = await compute_novelty_score(
        content=req.content,
        keyword=req.keyword,
        vertical=req.vertical,
        db=db,
    )
    return NoveltyScoreResponse(**result)
