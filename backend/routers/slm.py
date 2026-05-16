"""SLM vertical domain models router"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.postgres import get_db
from models.schemas import SLMVerticalsResponse, SLMVerticalInfo, SLMGenerateRequest, SLMGenerateResponse
from services.content_generator import full_content_pipeline

router = APIRouter(prefix="/api/v1/slm", tags=["Vertical SLM"])

SLM_VERTICALS = [
    SLMVerticalInfo(
        name="US Mortgage Banking", vertical_key="banking_lending",
        status="mvp_in_progress", entity_count=23, training_samples=0,
        description="Origination, servicing, GSE, CFPB, QM, LTV, DTI, HMDA, TRID",
    ),
    SLMVerticalInfo(
        name="Accounting & Finance Ops", vertical_key="accounting_finance",
        status="planned", entity_count=12, training_samples=0,
        description="AP/AR automation, ERP, GAAP, IFRS, financial close",
    ),
    SLMVerticalInfo(
        name="Investment & Wealth Tech", vertical_key="investment_wealth",
        status="planned", entity_count=11, training_samples=0,
        description="OMS, EMS, ESG, AUM, portfolio analytics, family office",
    ),
    SLMVerticalInfo(
        name="SAP & AI Supply Chain", vertical_key="sap_supply_chain",
        status="planned", entity_count=10, training_samples=0,
        description="S/4HANA, BTP, Ariba, supply chain orchestration",
    ),
]


@router.get("/verticals", response_model=SLMVerticalsResponse)
async def list_slm_verticals():
    return SLMVerticalsResponse(verticals=SLM_VERTICALS)


@router.post("/generate/{vertical}", response_model=SLMGenerateResponse)
async def slm_generate(vertical: str, req: SLMGenerateRequest, db: AsyncSession = Depends(get_db)):
    result = await full_content_pipeline(
        keyword=req.keyword, vertical=vertical,
        keyword_id=None, db=db, max_iterations=req.max_iterations,
    )
    return SLMGenerateResponse(
        content=result.get("content", ""),
        novelty_score=result.get("novelty_score", 0.0),
        vertical_specific_entities_used=int(result.get("entity_coverage", 0) * 20),
        iterations_used=result.get("iterations_used", 0),
        success=result.get("success", False),
    )
