"""M9 — Content generation router (Gemini-powered)"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from db.postgres import get_db
from models.schemas import GenerateRequest
from services.content_generator import full_content_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/generate", tags=["Content Generator"])


def _generate_response(result: dict, status_code: int = 200) -> JSONResponse:
    # Ensure predicted_position is always an int or None (not missing key)
    predicted = result.get("predicted_position")
    if predicted is not None:
        try:
            predicted = int(predicted)
        except (TypeError, ValueError):
            predicted = None

    return JSONResponse(
        status_code=status_code,
        content={
            "content": result.get("content", ""),
            "novelty_score": float(result.get("novelty_score") or 0.0),
            "predicted_position": predicted,
            "iterations_used": int(result.get("iterations_used") or 0),
            "success": bool(result.get("success", False)),
            "entity_coverage": float(result.get("entity_coverage") or 0.0),
            "job_id": result.get("job_id") or str(uuid.uuid4()),
            "processing_time_ms": int(result.get("processing_time_ms") or 0),
            "error": result.get("error") or "",
        },
    )


@router.post("")
async def generate_content(req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    """Generate B2B content with Gemini AI + novelty validation loop."""
    try:
        result = await full_content_pipeline(
            keyword=req.keyword,
            vertical=req.vertical,
            keyword_id=None,
            db=db,
            max_iterations=req.max_iterations,
            novelty_threshold=req.novelty_threshold,
        )
        return _generate_response(result)
    except Exception as exc:
        logger.exception("Content generation failed for keyword=%s", req.keyword)
        return _generate_response(
            {
                "success": False,
                "content": "",
                "error": f"Generation failed: {exc}",
                "iterations_used": 0,
                "novelty_score": 0.0,
                "entity_coverage": 0.0,
                "job_id": str(uuid.uuid4()),
                "processing_time_ms": 0,
            },
            status_code=200,
        )
