"""
Legacy scoring facade — delegates to scoring_engine for consistency.
"""
from typing import Any

from analysis.scoring_engine import build_content_analysis, score_novelty


def compute_content_score(
    content: str,
    competitor_contents: list[str],
    content_entities: set,
    competitor_entities: set,
    content_pairs: set,
    competitor_pairs: set,
) -> dict[str, Any]:
    """Backward-compatible wrapper; prefer scoring_engine.run_full_scoring."""
    class _Doc:
        def __init__(self, body: str, pos: int):
            self.body_content = body
            self.url = ""
            self.title = None
            self.position = pos

    serp_docs = [_Doc(c, i + 1) for i, c in enumerate(competitor_contents)]
    analysis = build_content_analysis(content, "", "accounting_finance", serp_docs)
    analysis.content_entity_set = {str(e).lower() for e in content_entities}
    analysis.serp_entity_set = {str(e).lower() for e in competitor_entities}
    analysis.content_svo_set = {tuple(p) for p in content_pairs if len(p) == 3}
    analysis.serp_svo_set = {tuple(p) for p in competitor_pairs if len(p) == 3}
    novelty = score_novelty(analysis)
    return {
        "novelty": {
            "novelty_score": novelty["novelty_score"] * 100,
            "factors": {
                "semantic_uniqueness": novelty["semantic_diversity"] * 100,
                "entity_uniqueness": novelty["entity_novelty"] * 100,
                "relationship_uniqueness": novelty["relationship_novelty"] * 100,
            },
            "reasoning": novelty["reasoning"],
        },
        "similarity_score": round(novelty["similarity_score"] * 100, 2),
        "overlap_percentage": round(novelty["similarity_score"] * 100, 2),
    }
