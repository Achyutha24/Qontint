"""M5 — Authority coverage router"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.postgres import get_db
from models.schemas import AuthorityCoverageRequest, AuthorityCoverageResponse
from services.authority_calculator import calculate_authority_coverage

router = APIRouter(prefix="/api/v1/authority", tags=["Authority Calculator"])


@router.post("/coverage", response_model=AuthorityCoverageResponse)
async def get_authority_coverage(req: AuthorityCoverageRequest):
    result = await calculate_authority_coverage(
        content=req.content,
        vertical=req.vertical,
        top_n=req.top_n,
    )
    return AuthorityCoverageResponse(**result)
