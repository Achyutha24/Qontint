# Qontint Intelligence Engine — Backend

**Semantic Authority Operating System | 100% Free Stack**

> No paid APIs. No licensing fees. Entirely open-source.

---

## Free Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| **LLM** | Ollama (`llama3.1:8b`, local) | **$0** |
| **SERP Data** | DuckDuckGo Search + httpx scraper | **$0** |
| **NLP** | spaCy `en_core_web_lg` | **$0** |
| **Graph DB** | Neo4j Community + GDS | **$0** |
| **Relational DB** | PostgreSQL 15 | **$0** |
| **Cache** | Redis 7 | **$0** |
| **Task Queue** | Celery + Redis | **$0** |
| **API Framework** | FastAPI | **$0** |
| **Total** | | **$0/month** |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEAM 1: INTELLIGENCE CORE                     │
│                                                                   │
│  M1 SERP Collector (DuckDuckGo + httpx)                          │
│  M2 Entity Extractor (spaCy en_core_web_lg + custom patterns)    │
│  M3 Graph Builder (Neo4j + GDS PageRank)                         │
│  M4 Novelty Scorer (3-component weighted algorithm)              │
│  M5 Authority Calculator (Neo4j top-N entity coverage)           │
│  M6 Ranking Predictor (GradientBoostingRegressor)                │
│  M7 FastAPI Gateway (async, <10s pipeline SLA)                   │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                    TEAM 2: GENERATION LAYER                       │
│                                                                   │
│  M9 Content Generator (Ollama — local LLM, FREE)                 │
│  M10 Integration Layer (full pipeline orchestration)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.ai/) — install and run locally

### 1. Pull the LLM model (one-time, ~4.7GB)
```bash
ollama pull llama3.1:8b
```

### 2. Configure environment
```bash
cd backend
cp .env.example .env
# Edit .env and set API_SECRET_KEY to a random 32-char string
```

### 3. Start all services
```bash
# From repo root
docker compose up -d
```

Services started:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **Neo4j Browser**: http://localhost:7474
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Ollama**: http://localhost:11434

### 4. Run database migrations
```bash
docker compose exec api alembic upgrade head
```

### 5. Load keyword seed data
```bash
docker compose exec api python data/load_seed_data.py
```

### 6. Verify everything works
```bash
# Health check
curl http://localhost:8000/health

# Keyword summary
curl http://localhost:8000/api/v1/keywords/summary

# Entity extraction test
curl -X POST http://localhost:8000/api/v1/entities/extract \
  -H "Content-Type: application/json" \
  -d '{"content": "SAP S/4HANA and supply chain orchestration are transforming procurement automation", "vertical": "sap_supply_chain"}'

# Full content analysis
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"content": "AP automation reduces invoice processing time...", "keyword": "AP automation software", "vertical": "accounting_finance"}'
```

---

## API Endpoints

| Method | Endpoint | Module | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/analyze` | M7 | **Core pipeline** — novelty + authority + ranking |
| POST | `/api/v1/serp/collect` | M1 | Queue SERP collection for a keyword |
| GET | `/api/v1/serp/results/{keyword_id}` | M1 | Get collected SERP results |
| POST | `/api/v1/entities/extract` | M2 | Extract entities from text |
| GET | `/api/v1/entities/vertical/{vertical}` | M2 | List entities by vertical |
| POST | `/api/v1/graph/build/{vertical}` | M3 | Trigger Neo4j graph build |
| GET | `/api/v1/graph/authority/{vertical}/top` | M3 | Top authority entities |
| POST | `/api/v1/novelty/score` | M4 | Score content novelty |
| POST | `/api/v1/authority/coverage` | M5 | Entity coverage analysis |
| POST | `/api/v1/ranking/predict` | M6 | Predict SERP position |
| POST | `/api/v1/ranking/train/{vertical}` | M6 | Train ranking model |
| GET | `/api/v1/keywords` | — | List/filter keywords |
| GET | `/api/v1/keywords/summary` | — | Keyword taxonomy summary |
| POST | `/api/v1/generate` | M9 | Generate content (Ollama) |
| GET | `/api/v1/slm/verticals` | — | Vertical SLM status |
| GET | `/health` | M7 | Service health check |

**Full interactive docs**: http://localhost:8000/docs

---

## Verticals

| Key | Name | Keywords |
|-----|------|---------|
| `accounting_finance` | Accounting & Finance Ops | 30 |
| `banking_lending` | Banking & Lending Ops | 27 |
| `investment_wealth` | Investment & Wealth Tech | 28 |
| `sap_supply_chain` | SAP & AI Supply Chain | 31 |

---

## Changing the LLM Model (Ollama)

Change `OLLAMA_MODEL` in `.env` to any [Ollama model](https://ollama.ai/library):

```bash
# Smaller / faster
OLLAMA_MODEL=phi3:medium        # 3.8GB RAM

# Better quality
OLLAMA_MODEL=mistral:7b         # 4.1GB RAM
OLLAMA_MODEL=qwen2.5:14b        # 8.2GB RAM

# Best quality (needs 40GB+ RAM)
OLLAMA_MODEL=llama3.1:70b
```

Then restart the API: `docker compose restart api`

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

Pure unit tests (no DB needed):
```bash
pytest tests/test_novelty.py -v
```

---

## Production Checklist

- [ ] Set `API_SECRET_KEY` to a strong random value
- [ ] Set `ENVIRONMENT=production`
- [ ] Configure `ALLOWED_ORIGINS` for your frontend domain
- [ ] Add reverse proxy (nginx) in front of the API
- [ ] Enable SSL/TLS
- [ ] Set up log aggregation
- [ ] Configure Celery beat for scheduled SERP refresh jobs
- [ ] Load full 116-keyword taxonomy (replace `data/keywords_seed.json`)

---

## Adding the Full 116-Keyword Taxonomy

Replace `backend/data/keywords_seed.json` with your full taxonomy JSON in the same format, then run:

```bash
docker compose exec api python data/load_seed_data.py
```

The loader is idempotent — safe to run multiple times.

---

## File Structure

```
backend/
├── main.py                    # FastAPI app + /api/v1/analyze
├── config.py                  # Pydantic settings
├── Dockerfile
├── requirements.txt
├── pytest.ini
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/001_initial.py
├── routers/
│   ├── health.py, keywords.py, serp.py, entities.py
│   ├── graph.py, novelty.py, authority.py, ranking.py
│   ├── generation.py, slm.py
├── services/
│   ├── serp_collector.py      # M1 — DuckDuckGo + httpx
│   ├── entity_extractor.py    # M2 — spaCy
│   ├── graph_builder.py       # M3 — Neo4j
│   ├── novelty_scorer.py      # M4
│   ├── authority_calculator.py # M5
│   ├── ranking_predictor.py   # M6 — GradientBoosting
│   └── content_generator.py   # M9+M10 — Ollama
├── db/
│   ├── postgres.py, neo4j_client.py, redis_client.py
├── models/
│   ├── db.py (ORM), schemas.py (Pydantic)
├── middleware/
│   ├── auth.py, rate_limiter.py, cors.py
├── tasks/
│   └── celery_tasks.py
├── data/
│   ├── keywords_seed.json
│   └── load_seed_data.py
└── tests/
    ├── conftest.py, test_novelty.py, test_api.py
```
