"""
Content Quality Engine
"""
from typing import Dict, Any

def analyze_readability(content: str) -> float:
    # A simple deterministic proxy for readability based on sentence and word length
    words = content.split()
    sentences = content.count('.') + content.count('!') + content.count('?')
    if not words or not sentences:
        return 0.5
    avg_words_per_sentence = len(words) / max(1, sentences)
    avg_chars_per_word = sum(len(w) for w in words) / max(1, len(words))
    
    # Target: ~15 words per sentence, ~5 chars per word (B2B standard)
    score = 1.0 - min(1.0, abs(avg_words_per_sentence - 15) / 30 + abs(avg_chars_per_word - 5) / 5)
    return max(0.1, score)

def analyze_structure(content: str) -> float:
    # Check H2/H3 distributions
    h2_count = content.count('## ')
    h3_count = content.count('### ')
    
    if h2_count >= 3 and h3_count >= 2:
        return 1.0
    elif h2_count >= 2:
        return 0.7
    elif h2_count > 0:
        return 0.4
    return 0.1

def analyze_semantic_richness(content: str) -> float:
    # Vocabulary diversity (unique words / total words)
    words = content.lower().split()
    if not words:
        return 0.0
    unique_words = set(words)
    ttr = len(unique_words) / len(words)  # Type-Token Ratio
    
    # Target TTR for rich content is often around 0.4 - 0.6
    score = min(1.0, ttr / 0.5)
    return score

def analyze_factual_density(content_length_words: int, entity_count: int) -> float:
    if content_length_words == 0:
        return 0.0
    # Entities per 100 words
    density = (entity_count / content_length_words) * 100
    
    # Good B2B content typically has 5-15 entities per 100 words
    if density >= 8:
        return 1.0
    elif density >= 4:
        return 0.7
    return max(0.1, density / 8)

def compute_content_quality(content: str, entity_count: int) -> float:
    """
    Computes overall content quality score.
    Returns value between 0.0 and 1.0.
    """
    readability = analyze_readability(content)
    structure = analyze_structure(content)
    richness = analyze_semantic_richness(content)
    
    words = content.split()
    density = analyze_factual_density(len(words), entity_count)
    
    quality_score = (readability * 0.2) + (structure * 0.3) + (richness * 0.2) + (density * 0.3)
    return quality_score

def get_quality_breakdown(content: str, entity_count: int) -> Dict[str, Any]:
    words = content.split()
    return {
        "readability": analyze_readability(content),
        "structure": analyze_structure(content),
        "richness": analyze_semantic_richness(content),
        "factual_density": analyze_factual_density(len(words), entity_count),
        "overall": compute_content_quality(content, entity_count)
    }
