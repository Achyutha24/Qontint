"""
M3 — Graph Builder (Neo4j)
4-stage pipeline: Extract → Build nodes → Co-occurrence edges → PageRank
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.neo4j_client import run_query, run_write_query
from models.db import SerpResult, Entity, EntityOccurrence
from analysis.entities import extract_entities_from_text, get_nlp, get_spacy_doc

import networkx as nx

logger = logging.getLogger(__name__)

def extract_svo_from_text(content: str, max_len: int = 50_000) -> list[tuple[str, str, str]]:
    doc = get_spacy_doc(content, max_len)
    
    svo_triples = []
    for token in doc:
        if token.pos_ == "VERB":
            subjects = [w.lemma_.lower() for w in token.lefts if w.dep_ in ("nsubj", "nsubjpass")]
            objects = [w.lemma_.lower() for w in token.rights if w.dep_ in ("dobj", "attr", "acomp")]
            
            for child in token.rights:
                if child.dep_ == "prep":
                    for p_child in child.rights:
                        if p_child.dep_ == "pobj":
                            objects.append(p_child.lemma_.lower())
                            
            # Add some fallback logic to pick up noun chunks
            if not subjects or not objects:
                continue
                
            for subj in subjects:
                for obj in objects:
                    if len(subj) >= 2 and len(obj) >= 2:
                        svo_triples.append((subj, token.lemma_.lower(), obj))
                        
    return svo_triples

def build_semantic_graph(content: str) -> nx.DiGraph:
    """Build a NetworkX semantic graph from content based on SVO triples."""
    triples = extract_svo_from_text(content)
    G = nx.DiGraph()
    for subj, verb, obj in triples:
        G.add_edge(subj, obj, relation=verb)
    return G

def get_graph_stats(G: nx.DiGraph) -> dict:
    """Calculate NetworkX graph stats."""
    return {
        "unique_edges": len(G.edges()),
        "density": nx.density(G) if len(G.nodes()) > 1 else 0.0,
        "nodes": len(G.nodes())
    }


async def build_graph_for_vertical(vertical: str, db: AsyncSession) -> dict[str, Any]:
    """Full 4-stage graph build pipeline for a vertical."""
    logger.info("Building entity graph for vertical: %s", vertical)

    # Stage 1 & 2: Load SERP results → create Entity nodes + APPEARS_IN edges
    result = await db.execute(
        select(SerpResult).where(SerpResult.vertical == vertical)
    )
    serp_results = result.scalars().all()

    nodes_created = 0
    edges_created = 0

    for doc in serp_results:
        if not doc.body_content:
            continue

        entities = extract_entities_from_text(doc.body_content, vertical)

        doc_node_id = f"doc:{doc.id}"
        # Upsert Document node
        await run_write_query(
            """
            MERGE (d:Document {id: $id})
            SET d.url = $url,
                d.serp_position = $pos,
                d.domain_rating = $dr,
                d.vertical = $vertical
            """,
            {"id": doc_node_id, "url": doc.url or "", "pos": doc.position,
             "dr": doc.domain_rating or 0.0, "vertical": vertical},
        )

        # Stage 2: Create Entity nodes + APPEARS_IN edges
        entity_texts_in_doc: list[str] = []
        for ent in entities:
            ent_id = f"ent:{vertical}:{ent['text'].lower()}"
            await run_write_query(
                """
                MERGE (e:Entity {id: $id})
                SET e.text = $text,
                    e.type = $type,
                    e.vertical = $vertical,
                    e.frequency = coalesce(e.frequency, 0) + 1
                WITH e
                MATCH (d:Document {id: $doc_id})
                MERGE (e)-[:APPEARS_IN]->(d)
                """,
                {
                    "id": ent_id,
                    "text": ent["text"],
                    "type": ent["entity_type"],
                    "vertical": vertical,
                    "doc_id": doc_node_id,
                },
            )
            entity_texts_in_doc.append(ent_id)
            nodes_created += 1

        # Stage 3: CO_OCCURS_WITH edges (all pairs in this document)
        for i, e1 in enumerate(entity_texts_in_doc):
            for e2 in entity_texts_in_doc[i + 1:]:
                await run_write_query(
                    """
                    MATCH (e1:Entity {id: $id1}), (e2:Entity {id: $id2})
                    MERGE (e1)-[r:CO_OCCURS_WITH]-(e2)
                    ON CREATE SET r.weight = 1, r.documents = 1
                    ON MATCH SET r.weight = r.weight + 1,
                                 r.documents = r.documents + 1
                    """,
                    {"id1": e1, "id2": e2},
                )
                edges_created += 1

    # Stage 4: PageRank authority scoring
    try:
        await run_graph_pagerank(vertical)
        logger.info("PageRank computed for %s", vertical)
    except Exception as exc:
        logger.warning("PageRank failed (GDS may not be available): %s", exc)

    return {
        "vertical": vertical,
        "nodes_created": nodes_created,
        "edges_created": edges_created,
    }


async def run_graph_pagerank(vertical: str) -> None:
    """Run GDS PageRank and write authority_score to Entity nodes."""
    # Create in-memory projection for this vertical's entities
    graph_name = f"entity-graph-{vertical}"

    # Drop if exists
    try:
        await run_query(
            "CALL gds.graph.drop($name, false)",
            {"name": graph_name},
        )
    except Exception:
        pass

    # Project graph (only entities of this vertical)
    await run_query(
        """
        CALL gds.graph.project.cypher(
          $name,
          'MATCH (e:Entity {vertical: $vertical}) RETURN id(e) AS id',
          'MATCH (e1:Entity {vertical: $vertical})-[r:CO_OCCURS_WITH]-(e2:Entity {vertical: $vertical})
           RETURN id(e1) AS source, id(e2) AS target, r.weight AS weight'
        )
        """,
        {"name": graph_name, "vertical": vertical},
    )

    # Run PageRank and write back
    await run_query(
        """
        CALL gds.pageRank.write($name, {
          maxIterations: 20,
          dampingFactor: 0.85,
          writeProperty: 'authority_score'
        })
        """,
        {"name": graph_name},
    )

    # Cleanup projection
    await run_query("CALL gds.graph.drop($name, false)", {"name": graph_name})


async def get_entity_neighbors(
    entity_id: str,
    depth: int = 2,
    min_weight: float = 0.1,
) -> dict[str, Any]:
    """Get entity neighbors from Neo4j up to given depth."""
    records = await run_query(
        """
        MATCH (e:Entity {id: $id})-[r:CO_OCCURS_WITH*1..$depth]-(neighbor:Entity)
        WHERE r[0].weight >= $min_weight
        RETURN neighbor.text AS text,
               neighbor.type AS type,
               neighbor.authority_score AS authority_score,
               r[0].weight AS weight
        ORDER BY weight DESC
        LIMIT 50
        """,
        {"id": entity_id, "depth": depth, "min_weight": min_weight},
    )
    return {"entity_id": entity_id, "neighbors": records}


async def get_top_authority_entities(
    vertical: str,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Get top N entities by authority_score for a vertical."""
    records = await run_query(
        """
        MATCH (e:Entity {vertical: $vertical})
        WHERE e.authority_score IS NOT NULL
        RETURN e.id AS id, e.text AS text, e.type AS type,
               e.authority_score AS authority_score,
               e.frequency AS frequency
        ORDER BY e.authority_score DESC
        LIMIT $limit
        """,
        {"vertical": vertical, "limit": limit},
    )
    
    if not records:
        # Fallback to SQLite
        from sqlalchemy import select, desc
        from db.postgres import AsyncSessionLocal
        from models.db import Entity
        
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(Entity)
                .where(Entity.vertical == vertical)
                .order_by(desc(Entity.frequency))
                .limit(limit)
            )
            entities = res.scalars().all()
            return [
                {"id": e.id, "text": e.text, "type": e.entity_type, 
                 "authority_score": e.authority_score or (e.frequency / 10.0), 
                 "frequency": e.frequency}
                for e in entities
            ]
            
    return records

async def get_full_graph_snapshot(vertical: str, limit: int = 200) -> dict[str, Any]:
    """Get nodes and edges for the full graph visualization."""
    node_records = await run_query(
        """
        MATCH (e:Entity {vertical: $vertical})
        RETURN e.id AS id, e.text AS label, e.type AS type, 
               e.authority_score AS authority, e.vertical AS vertical
        ORDER BY e.authority_score DESC LIMIT $limit
        """,
        {"vertical": vertical, "limit": limit}
    )
    
    # Fallback to SQLite (Simple Mode)
    if not node_records:
        from sqlalchemy import select, desc
        from db.postgres import AsyncSessionLocal
        from models.db import Entity, EntityOccurrence
        
        async with AsyncSessionLocal() as db:
            # Fetch nodes
            node_res = await db.execute(
                select(Entity)
                .where(Entity.vertical == vertical)
                .order_by(desc(Entity.authority_score), desc(Entity.frequency))
                .limit(limit)
            )
            entities = node_res.scalars().all()
            node_records = [
                {"id": e.id, "label": e.text, "type": e.entity_type, 
                 "authority": e.authority_score, "vertical": e.vertical}
                for e in entities
            ]
            node_ids = [e.id for e in entities]
            
            # Fetch co-occurrences (edges)
            # Find entities appearing in the same SerpResult
            edge_records = []
            if node_ids:
                # This query finds pairs of entities that share at least one SerpResult
                # To keep it efficient, we limit the search
                edge_res = await db.execute(
                    select(
                        EntityOccurrence.entity_id.label("source"),
                        EntityOccurrence.serp_result_id
                    ).where(EntityOccurrence.entity_id.in_(node_ids))
                )
                occurrences = edge_res.all()
                
                # Group by SerpResult
                by_serp: dict[str, list[str]] = {}
                for source, serp_id in occurrences:
                    if serp_id not in by_serp: by_serp[serp_id] = []
                    by_serp[serp_id].append(source)
                
                # Build edges
                edge_counts: dict[tuple[str, str], int] = {}
                for sources in by_serp.values():
                    for i in range(len(sources)):
                        for j in range(i + 1, len(sources)):
                            s, t = sorted([sources[i], sources[j]])
                            edge_counts[(s, t)] = edge_counts.get((s, t), 0) + 1
                
                for (s, t), weight in edge_counts.items():
                    edge_records.append({
                        "source": s, "target": t, 
                        "weight": min(weight / 10.0, 1.0), 
                        "relation": "CO_OCCURS_WITH"
                    })
            
            return {
                "nodes": node_records,
                "edges": edge_records
            }

    node_ids = [r["id"] for r in node_records]
    
    edge_records = await run_query(
        """
        MATCH (e1:Entity)-[r:CO_OCCURS_WITH]-(e2:Entity)
        WHERE e1.id IN $ids AND e2.id IN $ids
        RETURN e1.id AS source, e2.id AS target, r.weight AS weight, type(r) AS relation
        """,
        {"ids": node_ids}
    )
    
    return {
        "nodes": node_records,
        "edges": edge_records
    }
