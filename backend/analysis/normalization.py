"""
Normalization logic for standardizing scores across pipelines.
"""

def normalize_score_0_to_100(raw_value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """
    Standardize any metric into a 0-100 scale.
    """
    if raw_value <= min_val:
        return 0.0
    if raw_value >= max_val:
        return 100.0
    
    normalized = (raw_value - min_val) / (max_val - min_val)
    return round(normalized * 100, 2)

def normalize_0_to_1(raw_value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """
    Standardize any metric into a 0.0-1.0 scale.
    """
    if raw_value <= min_val:
        return 0.0
    if raw_value >= max_val:
        return 1.0
        
    return (raw_value - min_val) / (max_val - min_val)
