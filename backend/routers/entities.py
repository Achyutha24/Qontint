from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import time

from models.schemas import EntityExtractRequest, EntityExtractResponse, VerticalEntitiesResponse
from analysis.entities import extract_entities_from_text
from db.postgres import get_db

router = APIRouter(prefix="/api/v1/entities", tags=["Entities"])

@router.post("/extract", response_model=EntityExtractResponse)
async def extract_entities(req: EntityExtractRequest, db: AsyncSession = Depends(get_db)):
    start = time.perf_counter()
    entities = extract_entities_from_text(req.content, req.vertical)
    ms = int((time.perf_counter() - start) * 1000)
    return EntityExtractResponse(entities=entities, total=len(entities), processing_time_ms=ms)
