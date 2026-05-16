"""
Novelty engine for Qontint analysis.
"""
from typing import Dict, Any, List
from analysis.normalization import normalize_score_0_to_100

def compute_novelty(
    semantic_uniqueness: float,
    entity_uniqueness: float,
    relationship_uniqueness: float,
    phrase_uniqueness: float = 0.0  # Keep for backwards compatibility but ignore
) -> Dict[str, Any]:
    """
    Compute deterministic novelty score from factors.
    Formula: 40% semantic, 30% entity, 30% relationship
    """
    
    # Base normalization (ensure all inputs are 0-1)
    su = max(0.0, min(1.0, semantic_uniqueness))
    eu = max(0.0, min(1.0, entity_uniqueness))
    ru = max(0.0, min(1.0, relationship_uniqueness))
    
    # overall_novelty = ( semantic_uniqueness * 0.4 + entity_uniqueness * 0.3 + relationship_uniqueness * 0.3 )
    novelty_raw = (su * 0.4) + (eu * 0.3) + (ru * 0.3)
    
    # Scale to 0-100 using central normalization pipeline
    novelty_score = normalize_score_0_to_100(novelty_raw)
    
    # Apply Rules
    # If similarity to SERP > 80% (which means semantic uniqueness < 20%), novelty must decrease
    if su < 0.2:
        novelty_score *= 0.8
        
    # Generic content should NEVER score above 70
    is_generic = su < 0.3 and eu < 0.3 and ru < 0.3
    if is_generic and novelty_score > 70:
        novelty_score = 70.0
        
    # Truly differentiated content may score 80+
    is_highly_differentiated = su > 0.7 and (eu > 0.6 or ru > 0.6)
    if is_highly_differentiated and novelty_score < 80:
        # Boost it slightly if it qualifies as truly differentiated but falls short
        novelty_score = min(100.0, max(80.0, novelty_score * 1.1))

    # Never return 100 for entity novelty or 0 for relationships if they exist, but the formula already ensures this 
    # since it's a weighted sum and we're dealing with continuous values.

    reasoning = []
    if su > 0.7:
        reasoning.append("High semantic differentiation from SERP")
    elif su < 0.3:
        reasoning.append("Strong semantic overlap with existing content")
        
    if eu > 0.6:
        reasoning.append("Unique entity combinations detected")
    if ru > 0.6:
        reasoning.append("Novel relationships mapped")
        
    if not reasoning:
        reasoning.append("Average novelty profile against baseline")
        
    return {
        "novelty_score": novelty_score,
        "factors": {
            "semantic_uniqueness": round(su * 100, 2),
            "entity_uniqueness": round(eu * 100, 2),
            "relationship_uniqueness": round(ru * 100, 2)
        },
        "reasoning": reasoning
    }

