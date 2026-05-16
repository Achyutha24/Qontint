"""
Deterministic SERP Rank Prediction.
"""
from typing import Dict, Any

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor

_gb_model = None

def _get_or_train_model():
    global _gb_model
    if _gb_model is None:
        X = []
        y = []
        np.random.seed(42)
        # Synthesize 1000 samples reflecting the rules
        for _ in range(1000):
            cl = np.random.uniform(300, 3000)
            hd = np.random.uniform(1, 5)
            ec = np.random.uniform(0.1, 1.0)
            ss = np.random.uniform(0.1, 1.0)
            ns = np.random.uniform(0.1, 1.0)
            re = np.random.uniform(0.3, 1.0)
            kd = np.random.uniform(0.01, 0.05)
            ta = np.random.uniform(0.1, 1.0)
            rd = np.random.uniform(0.1, 1.0)
            sd = np.random.uniform(0.3, 0.9)
            
            # Prediction rules:
            base_score = (
                (ec * 0.20) + 
                (ns * 0.15) + 
                (ta * 0.20) + 
                (rd * 0.15) + 
                (re * 0.10) + 
                ((1.0 - sd) * 0.10) +
                (min(cl/1500, 1.0) * 0.10)
            )
            
            rank = int(100 - (base_score * 90))
            # thin/generic content should rank poorly
            if cl < 500 or (ec < 0.3 and ns < 0.3):
                rank += 30
            # low authority lowers rank prediction
            if ta < 0.3:
                rank += 20
            # missing semantic relationships lower prediction
            if rd < 0.3:
                rank += 20
                
            rank = max(1, min(100, rank))
            
            X.append([cl, hd, ec, ss, ns, re, kd, ta, rd, sd])
            y.append(rank)
            
        _gb_model = GradientBoostingRegressor(n_estimators=50, random_state=42)
        _gb_model.fit(X, y)

    return _gb_model


def warmup_rank_model() -> None:
    """Pre-train ranking model at startup to avoid first-request latency."""
    _get_or_train_model()

def predict_rank_ml(features: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic ranking — delegates to rule-based formula (no random ML)."""
    from analysis.scoring_engine import clamp01

    cl = float(features.get("content_length", 1000.0))
    ec = clamp01(features.get("entity_coverage", 0.5))
    ss = clamp01(features.get("semantic_similarity", 0.5))
    ns = clamp01(features.get("novelty_score", 0.5))
    re = clamp01(features.get("readability", 0.5))
    ta = clamp01(features.get("topical_authority", 0.5))
    rd = clamp01(features.get("relationship_density", 0.5))
    sd = clamp01(features.get("SERP_difficulty", 0.5))
    hd = float(features.get("heading_depth", 2.0))

    strength = (
        ec * 0.22 + ns * 0.20 + rd * 0.15 + re * 0.12
        + (1.0 - ss) * 0.11 + min(cl / 1500.0, 1.0) * 0.10
        + min(hd / 4.0, 1.0) * 0.05 - sd * 0.10
    )
    strength = clamp01(strength)
    predicted_pos = max(1, min(100, int(round(100 - strength * 88))))

    gaps = []
    if cl < 500:
        predicted_pos = min(100, predicted_pos + 25)
        gaps.append("Thin content, consider expanding.")
    if ec < 0.25:
        predicted_pos = min(100, predicted_pos + 20)
        gaps.append("Low entity coverage vs authority baseline.")
    if rd < 0.15:
        predicted_pos = min(100, predicted_pos + 15)
        gaps.append("Missing semantic relationships.")
    if ns < 0.35:
        predicted_pos = min(100, predicted_pos + 15)
        gaps.append("Content lacks unique semantic value.")

    confidence = 0.35 + (0.25 if cl >= 600 else 0) + (0.15 if ec > 0.2 else 0)
    confidence = round(clamp01(confidence), 3)

    return {
        "predicted_rank": predicted_pos,
        "confidence": confidence,
        "ranking_factors": {
            "content_length": cl,
            "entity_coverage": round(ec, 2),
            "semantic_similarity": round(ss, 2),
            "novelty_score": round(ns, 2),
            "topical_authority": round(ta, 2),
            "relationship_density": round(rd, 2),
        },
        "optimization_gaps": gaps,
    }
