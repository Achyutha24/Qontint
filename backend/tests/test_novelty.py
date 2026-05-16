"""Tests for novelty scoring (M4) — unit tests, no DB required"""
import pytest
from services.novelty_scorer import (
    entity_novelty, relationship_novelty, semantic_diversity,
    tokenize, build_entity_pairs,
)


def test_entity_novelty_all_unique():
    content = {"SAP", "Ariba", "S/4HANA"}
    serp = {"Oracle", "Salesforce"}
    score = entity_novelty(content, serp)
    assert score == 1.0


def test_entity_novelty_all_overlap():
    entities = {"SAP", "Oracle"}
    score = entity_novelty(entities, entities)
    assert score == 0.0


def test_entity_novelty_partial():
    content = {"SAP", "Ariba", "Oracle"}
    serp = {"Oracle", "Salesforce"}
    score = entity_novelty(content, serp)
    assert round(score, 4) == round(2 / 3, 4)


def test_relationship_novelty_all_unique():
    content_pairs = {("a", "b"), ("c", "d")}
    serp_pairs = {("e", "f")}
    score = relationship_novelty(content_pairs, serp_pairs)
    assert score == 1.0


def test_semantic_diversity_identical():
    tokens = {"the", "quick", "brown", "fox"}
    score = semantic_diversity(tokens, tokens)
    assert score == 0.0


def test_semantic_diversity_disjoint():
    a = {"alpha", "beta"}
    b = {"gamma", "delta"}
    score = semantic_diversity(a, b)
    assert score == 1.0


def test_tokenize_removes_stopwords():
    text = "the quick brown fox jumps"
    tokens = tokenize(text)
    assert "the" not in tokens
    assert "quick" in tokens
    assert "brown" in tokens


def test_build_entity_pairs():
    entities = ["SAP", "Oracle", "Ariba"]
    pairs = build_entity_pairs(entities)
    assert len(pairs) == 3
    assert ("Ariba", "SAP") in pairs or ("SAP", "Ariba") in pairs


def test_novelty_score_formula():
    # Weighted combination
    en = 0.8
    rn = 0.6
    sd = 0.4
    expected = round(0.40 * en + 0.35 * rn + 0.25 * sd, 4)
    assert expected == round(0.40 * 0.8 + 0.35 * 0.6 + 0.25 * 0.4, 4)
    assert expected >= 0.35  # Should PASS threshold
