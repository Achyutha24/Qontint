"""
Mock Neo4j client for zero-dependency local run.
"""
from __future__ import annotations
import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

logger = logging.getLogger(__name__)

class MockNeo4jSession:
    async def run(self, query: str, parameters: dict[str, Any] | None = None):
        return []
        
    async def execute_write(self, func):
        return []

@asynccontextmanager
async def get_neo4j_session() -> AsyncGenerator[MockNeo4jSession, None]:
    yield MockNeo4jSession()

async def neo4j_dependency() -> AsyncGenerator[MockNeo4jSession, None]:
    async with get_neo4j_session() as session:
        yield session

async def run_query(query: str, parameters: dict[str, Any] | None = None, database: str = "neo4j") -> list[dict[str, Any]]:
    return []

async def run_write_query(query: str, parameters: dict[str, Any] | None = None, database: str = "neo4j") -> list[dict[str, Any]]:
    return []

async def ensure_indexes() -> None:
    pass

async def close_driver() -> None:
    pass

async def check_neo4j_health() -> bool:
    return True

