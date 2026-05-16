"""Integration tests for the health and keywords endpoints"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_root_returns_stack_info(client):
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Qontint" in data["name"]
    assert "ollama" in data["stack"]["llm"].lower()


@pytest.mark.asyncio
async def test_health_endpoint_returns_services(client):
    with (
        patch("db.postgres.check_db_health", return_value=True),
        patch("db.neo4j_client.check_neo4j_health", return_value=True),
        patch("db.redis_client.check_redis_health", return_value=True),
    ):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "services" in data
        assert len(data["services"]) >= 3


@pytest.mark.asyncio
async def test_entity_extract_endpoint(client):
    payload = {
        "content": "SAP S/4HANA and supply chain orchestration are transforming procurement automation",
        "vertical": "sap_supply_chain",
    }
    # Mock spaCy to avoid loading model in tests
    with patch("routers.entities.extract_entities_from_text") as mock_extract:
        mock_extract.return_value = [
            {"text": "SAP S/4HANA", "entity_type": "PRODUCT", "confidence": 1.0, "authority_score": 0.0},
            {"text": "supply chain orchestration", "entity_type": "TECHNOLOGY", "confidence": 1.0, "authority_score": 0.0},
        ]
        response = await client.post("/api/v1/entities/extract", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "entities" in data
        assert data["total"] == 2
