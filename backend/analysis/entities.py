"""
M2 — Entity Extractor (spaCy en_core_web_lg + custom vertical patterns)
"""
from __future__ import annotations

import functools
import logging
import time
import uuid
from typing import Any
from collections import Counter

import spacy
from spacy.language import Language
from spacy.matcher import PhraseMatcher
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.db import Entity, EntityOccurrence

logger = logging.getLogger(__name__)

_nlp: Language | None = None

VERTICAL_PATTERNS: dict[str, list[dict]] = {
    "accounting_finance": [
        {"label": "TECHNOLOGY", "pattern": "AP automation"},
        {"label": "TECHNOLOGY", "pattern": "AR automation"},
        {"label": "TECHNOLOGY", "pattern": "financial close"},
        {"label": "TECHNOLOGY", "pattern": "month-end close"},
        {"label": "PRODUCT", "pattern": "ERP"},
        {"label": "CONCEPT", "pattern": "GAAP"},
        {"label": "CONCEPT", "pattern": "IFRS"},
        {"label": "CONCEPT", "pattern": "cash flow"},
        {"label": "CONCEPT", "pattern": "accounts payable"},
        {"label": "CONCEPT", "pattern": "accounts receivable"},
        {"label": "CONCEPT", "pattern": "procure-to-pay"},
        {"label": "CONCEPT", "pattern": "order-to-cash"},
    ],
    "banking_lending": [
        {"label": "TECHNOLOGY", "pattern": "core banking"},
        {"label": "TECHNOLOGY", "pattern": "digital lending"},
        {"label": "TECHNOLOGY", "pattern": "BaaS"},
        {"label": "TECHNOLOGY", "pattern": "embedded finance"},
        {"label": "TECHNOLOGY", "pattern": "RegTech"},
        {"label": "CONCEPT", "pattern": "KYC"},
        {"label": "CONCEPT", "pattern": "AML"},
        {"label": "CONCEPT", "pattern": "credit scoring"},
        {"label": "CONCEPT", "pattern": "loan origination"},
        {"label": "CONCEPT", "pattern": "mortgage banking"},
        {"label": "REGULATION", "pattern": "CFPB"},
        {"label": "REGULATION", "pattern": "Basel III"},
        {"label": "CONCEPT", "pattern": "GSE"},
        {"label": "CONCEPT", "pattern": "LTV"},
        {"label": "CONCEPT", "pattern": "DTI"},
        {"label": "REGULATION", "pattern": "RESPA"},
        {"label": "REGULATION", "pattern": "HMDA"},
        {"label": "ORG", "pattern": "Fannie Mae"},
        {"label": "ORG", "pattern": "Freddie Mac"},
    ],
    "investment_wealth": [
        {"label": "TECHNOLOGY", "pattern": "OMS"},
        {"label": "TECHNOLOGY", "pattern": "EMS"},
        {"label": "CONCEPT", "pattern": "ESG"},
        {"label": "CONCEPT", "pattern": "AUM"},
        {"label": "TECHNOLOGY", "pattern": "portfolio analytics"},
        {"label": "CONCEPT", "pattern": "alpha generation"},
        {"label": "CONCEPT", "pattern": "family office"},
        {"label": "CONCEPT", "pattern": "buy-side"},
        {"label": "TECHNOLOGY", "pattern": "robo-advisor"},
        {"label": "REGULATION", "pattern": "MiFID II"},
        {"label": "CONCEPT", "pattern": "fiduciary duty"},
    ],
    "sap_supply_chain": [
        {"label": "PRODUCT", "pattern": "S/4HANA"},
        {"label": "PRODUCT", "pattern": "SAP S/4HANA"},
        {"label": "PRODUCT", "pattern": "BTP"},
        {"label": "PRODUCT", "pattern": "SAP BTP"},
        {"label": "PRODUCT", "pattern": "Ariba"},
        {"label": "TECHNOLOGY", "pattern": "supply chain orchestration"},
        {"label": "TECHNOLOGY", "pattern": "procurement automation"},
        {"label": "TECHNOLOGY", "pattern": "AI agents"},
        {"label": "CONCEPT", "pattern": "demand planning"},
        {"label": "CONCEPT", "pattern": "supply chain visibility"},
    ],
}

CUSTOM_FINTECH_ENTITIES = [
    "artificial intelligence",
    "machine learning",
    "predictive analytics",
    "logistics",
    "supply chain",
    "inventory management",
    "automation",
    "ERP",
    "warehouse optimization",
    "demand forecasting"
]


def get_nlp() -> Language:
    global _nlp
    if _nlp is None:
        logger.info("Loading spaCy model en_core_web_lg...")
        _nlp = spacy.load("en_core_web_lg")
        ruler = _nlp.add_pipe("entity_ruler", name="vertical_ruler", before="ner")
        all_patterns = [p for patterns in VERTICAL_PATTERNS.values() for p in patterns]
        for kw in CUSTOM_FINTECH_ENTITIES:
            all_patterns.append({"label": "CUSTOM_KEYWORD", "pattern": kw})
            all_patterns.append({"label": "CUSTOM_KEYWORD", "pattern": kw.lower()})
            all_patterns.append({"label": "CUSTOM_KEYWORD", "pattern": kw.title()})
            all_patterns.append({"label": "CUSTOM_KEYWORD", "pattern": kw.upper()})
        ruler.add_patterns(all_patterns)
        logger.info("spaCy model + vertical patterns loaded")
    return _nlp

_phrase_matcher: PhraseMatcher | None = None


def get_phrase_matcher(nlp: Language) -> PhraseMatcher:
    global _phrase_matcher
    if _phrase_matcher is None:
        matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
        patterns = [nlp.make_doc(text) for text in CUSTOM_FINTECH_ENTITIES]
        matcher.add("FINTECH_ENTITIES", patterns)
        _phrase_matcher = matcher
    return _phrase_matcher


@functools.lru_cache(maxsize=256)
def get_spacy_doc(content: str, max_len: int):
    nlp = get_nlp()
    return nlp(content[:max_len])


def extract_entities_from_text(content: str, vertical: str, max_len: int = 50_000) -> list[dict[str, Any]]:
    nlp = get_nlp()
    doc = get_spacy_doc(content, max_len)
    matcher = get_phrase_matcher(nlp)
    matches = matcher(doc)

    KEEP_LABELS = {"ORG", "PRODUCT", "GPE", "PERSON", "LAW", "NORP",
                   "TECHNOLOGY", "CONCEPT", "REGULATION", "CUSTOM_KEYWORD"}
    
    raw_entities = []

    # NER and Ruler entities
    for ent in doc.ents:
        text = ent.lemma_.lower().strip()
        label = ent.label_
        if label in KEEP_LABELS and 2 <= len(text) <= 100:
            raw_entities.append((text, label))

    # PhraseMatcher entities
    for match_id, start, end in matches:
        span = doc[start:end]
        text = span.lemma_.lower().strip()
        if 2 <= len(text) <= 100:
            raw_entities.append((text, "CUSTOM_KEYWORD"))
            
    # Noun chunks
    for chunk in doc.noun_chunks:
        text = chunk.lemma_.lower().strip()
        if 3 <= len(text) <= 50:
            raw_entities.append((text, "NOUN_CHUNK"))

    # Compute frequency
    freq_counter = Counter(raw_entities)
    
    entities = []
    seen = set()

    for (text, label), freq in freq_counter.items():
        if text in seen:
            continue
        seen.add(text)
        
        custom = label in {"TECHNOLOGY", "CONCEPT", "REGULATION", "CUSTOM_KEYWORD"}
        confidence = 1.0 if custom else 0.85
        
        # Determine semantic cluster
        cluster = "general"
        if label in {"TECHNOLOGY", "PRODUCT"}: cluster = "technology"
        elif label in {"CONCEPT", "NOUN_CHUNK"}: cluster = "concept"
        elif label in {"ORG", "PERSON", "GPE"}: cluster = "named_entity"
        elif label == "CUSTOM_KEYWORD": cluster = "industry_term"
        
        entities.append({
            "entity": text, # Requested format
            "text": text,   # Backwards compatibility
            "entity_type": label,
            "frequency": freq,
            "relevance_score": confidence * (1.0 + min(freq, 5) * 0.1),
            "semantic_cluster": cluster,
            "confidence": confidence,
            "authority_score": 0.0,
        })
        
    return entities


async def extract_and_store_entities(
    content: str,
    vertical: str,
    serp_result_id: str,
    db: AsyncSession,
) -> list[dict[str, Any]]:
    entities = extract_entities_from_text(content, vertical)

    needed_texts = [e["text"] for e in entities]
    entity_cache = {}
    if needed_texts:
        for i in range(0, len(needed_texts), 500):
            batch = needed_texts[i:i+500]
            ent_res = await db.execute(select(Entity).where(Entity.text.in_(batch), Entity.vertical == vertical))
            for ent_obj in ent_res.scalars().all():
                entity_cache[ent_obj.text] = ent_obj

    for ent_data in entities:
        text = ent_data["text"]
        if text in entity_cache:
            entity = entity_cache[text]
            entity.frequency += 1
        else:
            entity = Entity(
                id=str(uuid.uuid4()),
                text=text,
                entity_type=ent_data["entity_type"],
                vertical=vertical,
                frequency=1,
            )
            db.add(entity)
            entity_cache[text] = entity

        db.add(EntityOccurrence(
            id=str(uuid.uuid4()),
            entity_id=entity.id,
            serp_result_id=serp_result_id,
            confidence=ent_data["confidence"],
        ))

    await db.commit()
    return entities
