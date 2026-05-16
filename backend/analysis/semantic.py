import logging
import os
import numpy as np
from typing import List, Dict, Any

# Quieter HuggingFace loads; models are warmed at API startup
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

_model: SentenceTransformer | None = None

def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("Loading sentence-transformers model (all-MiniLM-L6-v2)...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Sentence-transformers model loaded.")
    return _model

def get_embedding(text: str) -> np.ndarray:
    model = get_embedding_model()
    return model.encode([text])[0]

def get_embeddings_batch(texts: List[str]) -> np.ndarray:
    model = get_embedding_model()
    return model.encode(texts)

def compute_similarity(text1: str, text2: str) -> float:
    """Compute cosine similarity between two texts."""
    model = get_embedding_model()
    embeddings = model.encode([text1, text2])
    sim = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
    return float(sim)

def _truncate_corpus(texts: List[str], max_chars: int) -> List[str]:
    return [t[:max_chars] for t in texts if t]


def compute_corpus_similarity(source_text: str, corpus_texts: List[str], max_chars: int = 800) -> Dict[str, Any]:
    """
    Compare source text against a list of corpus texts (e.g. competitors).
    Returns similarity stats.
    """
    source_text = source_text[:max_chars * 2]
    corpus_texts = _truncate_corpus(corpus_texts, max_chars)

    if not corpus_texts:
        logger.warning("corpus_texts is empty — returning neutral similarity (collect SERP first)")
        return {
            "similarity_score": 0.55,
            "novelty_score": 0.45,
            "overlap_percentage": 0.50,
            "serp_grounded": False,
        }
    
    model = get_embedding_model()
    source_emb = model.encode([source_text])[0]
    corpus_embs = model.encode(corpus_texts)
    
    similarities = cosine_similarity([source_emb], corpus_embs)[0]
    max_sim = float(np.max(similarities))
    mean_sim = float(np.mean(similarities))
    
    return {
        "similarity_score": max_sim,
        "novelty_score": 1.0 - max_sim,
        "overlap_percentage": mean_sim,
    }
