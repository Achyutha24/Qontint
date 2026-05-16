from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from models.schemas import GraphBuildRequest, GraphBuildResponse, EntityNeighborsResponse, AuthorityTopResponse
from analysis.relationships import get_top_authority_entities, get_full_graph_snapshot
from db.postgres import get_db

router = APIRouter(prefix="/api/v1/graph", tags=["Graph"])

@router.post("/build", response_model=GraphBuildResponse)
async def build_graph(req: GraphBuildRequest, db: AsyncSession = Depends(get_db)):
    return GraphBuildResponse(job_id="dummy", status="done", message="Graph built")

@router.get("/authority/top", response_model=AuthorityTopResponse)
async def get_top_authority(vertical: str, limit: int = 20):
    entities = await get_top_authority_entities(vertical=vertical, limit=limit)
    return AuthorityTopResponse(vertical=vertical, entities=entities, total=len(entities))

@router.get("/snapshot/{vertical}")
async def get_graph_snapshot(vertical: str, limit: int = 200):
    """Return nodes and edges for the 3D graph visualization."""
    try:
        data = await get_full_graph_snapshot(vertical=vertical, limit=limit)
        return JSONResponse(content=data)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"nodes": [], "edges": [], "error": str(exc)}
        )
