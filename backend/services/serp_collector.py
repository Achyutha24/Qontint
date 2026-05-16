"""
M1 — SERP Intelligence Collector
Replaces Ahrefs ($99/mo) with Playwright + DuckDuckGo (100% free).

Collects top-20 SERP results per keyword:
  1. DuckDuckGo search → get top 20 URLs (free, no rate limits)
  2. Playwright (headless Chromium) → full page scrape of each URL
  3. BeautifulSoup → extract title, meta, body text, word count
  4. SHA-256 dedup → skip re-scraping if content unchanged
"""
from __future__ import annotations

import asyncio
import functools
import hashlib
import logging
import time
import uuid
from typing import Any

import httpx
from bs4 import BeautifulSoup
from duckduckgo_search import DDGS
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from models.db import Keyword, SerpResult
from analysis.entities import extract_and_store_entities
from config import settings

logger = logging.getLogger(__name__)

VERTICAL_SEARCH_CONTEXT = {
    "accounting_finance": "B2B accounting finance software",
    "banking_lending": "banking lending fintech",
    "investment_wealth": "investment wealth management technology",
    "sap_supply_chain": "SAP supply chain enterprise software",
}


# ── Main collection orchestrator ──────────────────────────────────────────────
async def collect_serp_for_keyword(
    keyword_id: str,
    vertical: str,
    db: AsyncSession,
    force_refresh: bool = False,
    fast_mode: bool = False,
) -> dict[str, Any]:
    """
    Collect SERP results for a keyword.
    Returns a summary dict with counts and status.
    """
    # Load keyword from DB
    result = await db.execute(select(Keyword).where(Keyword.id == keyword_id))
    keyword = result.scalar_one_or_none()
    if not keyword:
        raise ValueError(f"Keyword {keyword_id} not found")

    query = keyword.query
    context = VERTICAL_SEARCH_CONTEXT.get(vertical, "")
    search_query = f"{query} {context}".strip()

    max_results = settings.ANALYZE_SERP_MAX_RESULTS if fast_mode else settings.SCRAPER_MAX_RESULTS
    scrape_timeout_ms = settings.ANALYZE_SERP_TIMEOUT_MS if fast_mode else 15_000
    body_cap = settings.ANALYZE_SERP_BODY_MAX_CHARS if fast_mode else 50_000

    logger.info(
        "Collecting SERP for: '%s' (vertical: %s, fast_mode=%s)",
        query, vertical, fast_mode,
    )

    # Step 1: Get URLs via DuckDuckGo (free)
    urls = await search_duckduckgo(search_query, max_results=max_results)
    logger.info("Found %d URLs for '%s'", len(urls), query)

    collected = 0
    skipped = 0

    # Step 2: Scrape URLs concurrently
    urls_to_scrape = urls[:max_results]
    
    async def fetch_url(position: int, url: str) -> dict[str, Any] | None:
        try:
            page_data = await scrape_url(url, timeout_ms=scrape_timeout_ms)
            page_data["position"] = position
            page_data["url"] = url
            if body_cap and page_data.get("body_content"):
                page_data["body_content"] = page_data["body_content"][:body_cap]
            return page_data
        except Exception as exc:
            logger.warning("Failed to scrape %s: %s", url, exc)
            return None

    tasks = []
    for position, url_data in enumerate(urls_to_scrape, start=1):
        url = url_data.get("href", "")
        if url and url.startswith("http"):
            tasks.append(fetch_url(position, url))

    scraped_results = await asyncio.gather(*tasks)

    # Step 3: Process and store results (skip spaCy entity extraction in fast_mode)
    entity_cache = {}

    for page_data in scraped_results:
        if not page_data:
            continue
            
        position = page_data["position"]
        url = page_data["url"]
        content_hash = sha256_hash(page_data.get("body_content", ""))

        # Deduplication check
        existing = await db.execute(
            select(SerpResult).where(
                SerpResult.keyword_id == keyword_id,
                SerpResult.position == position,
            )
        )
        existing_result = existing.scalar_one_or_none()

        if existing_result and not force_refresh:
            if existing_result.content_hash == content_hash:
                skipped += 1
                continue
            # Content changed — update it
            existing_result.title = page_data.get("title")
            existing_result.meta_description = page_data.get("meta_description")
            existing_result.body_content = page_data.get("body_content")
            existing_result.word_count = page_data.get("word_count", 0)
            existing_result.content_hash = content_hash
            existing_result.domain_rating = estimate_domain_rating(position)
        else:
            serp_result = SerpResult(
                id=str(uuid.uuid4()),
                keyword_id=keyword_id,
                vertical=vertical,
                position=position,
                url=url,
                title=page_data.get("title"),
                meta_description=page_data.get("meta_description"),
                body_content=page_data.get("body_content"),
                word_count=page_data.get("word_count", 0),
                domain_rating=estimate_domain_rating(position),
                content_hash=content_hash,
            )
            db.add(serp_result)

            # Entity extraction is expensive — skip during analyze fast path
            if fast_mode or not serp_result.body_content:
                collected += 1
                continue

            # Extract and store entities for the graph (full collection only)
            if serp_result.body_content:
                # To prevent blocking the event loop for too long, we use a thread pool for spaCy
                loop = asyncio.get_event_loop()
                from analysis.entities import extract_entities_from_text
                # extract_entities_from_text is synchronous and slow
                entities = await loop.run_in_executor(
                    None, 
                    functools.partial(extract_entities_from_text, serp_result.body_content, vertical, max_len=2500)
                )
                
                # Now store them asynchronously with batching
                from models.db import Entity, EntityOccurrence
                needed_texts = [e["text"] for e in entities if e["text"] not in entity_cache]
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
                        serp_result_id=serp_result.id,
                        confidence=ent_data["confidence"],
                    ))

        collected += 1

    await db.commit()

    return {
        "keyword_id": keyword_id,
        "keyword_query": query,
        "collected": collected,
        "skipped": skipped,
        "total_urls_found": len(urls),
    }


# ── DuckDuckGo Search (FREE, no API key) ─────────────────────────────────────
async def search_duckduckgo(query: str, max_results: int = 20) -> list[dict]:
    """
    Search DuckDuckGo and return top N results.
    Uses the duckduckgo-search library — completely free, no API key.
    If DuckDuckGo rate-limits, falls back to Wikipedia OpenSearch API.
    """
    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            lambda: list(DDGS().text(query, max_results=max_results))
        )
        if results:
            return results
    except Exception as exc:
        logger.warning("DuckDuckGo search failed: %s. Falling back to Wikipedia.", exc)

    # Fallback to Wikipedia API if DDG rate limited
    try:
        import urllib.parse
        encoded_query = urllib.parse.quote(query) 
        url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={encoded_query}&limit={max_results}&namespace=0&format=json"
        
        headers = {
            "User-Agent": "QontintBot/1.0 (achyu@example.com) Mozilla/5.0",
            "Accept": "application/json"
        }
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            
            # OpenSearch format: [search_term, [titles], [descriptions], [urls]]
            urls = data[3] if len(data) > 3 else []
            titles = data[1] if len(data) > 1 else []
            
            results = []
            for i, u in enumerate(urls):
                results.append({
                    "href": u,
                    "title": titles[i] if i < len(titles) else u,
                    "body": "Wikipedia fallback result"
                })
            return results
    except Exception as exc:
        logger.error("Wikipedia fallback also failed: %s", exc)
        return []


# ── Playwright Scraper (headless Chromium — FREE) ─────────────────────────────
async def scrape_url(url: str, timeout_ms: int = 15_000) -> dict[str, Any]:
    """
    Scrape a URL using httpx (fast, lightweight).
    Falls back gracefully if the page fails.
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    async with httpx.AsyncClient(
        timeout=timeout_ms / 1000,
        follow_redirects=True,
        headers=headers,
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        return parse_html(response.text, url)


def parse_html(html: str, url: str) -> dict[str, Any]:
    """Parse HTML and extract structured content."""
    soup = BeautifulSoup(html, "lxml")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()

    # Title
    title = ""
    if soup.title:
        title = soup.title.string or ""
    elif soup.find("h1"):
        title = soup.find("h1").get_text(strip=True)

    # Meta description
    meta_desc = ""
    meta_tag = soup.find("meta", attrs={"name": "description"})
    if meta_tag:
        meta_desc = meta_tag.get("content", "")

    # Body text (prioritize article/main content)
    content_selectors = ["article", "main", "[role='main']", ".content", "#content", "body"]
    body_text = ""
    for selector in content_selectors:
        element = soup.select_one(selector)
        if element:
            body_text = element.get_text(separator=" ", strip=True)
            if len(body_text) > 200:
                break

    if not body_text:
        body_text = soup.get_text(separator=" ", strip=True)

    # Word count
    word_count = len(body_text.split()) if body_text else 0

    return {
        "url": url,
        "title": title[:500] if title else None,
        "meta_description": meta_desc[:500] if meta_desc else None,
        "body_content": body_text[:50_000],  # cap at 50K chars
        "word_count": word_count,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────
def sha256_hash(content: str) -> str:
    """SHA-256 hash of content for deduplication."""
    return hashlib.sha256(content.encode("utf-8", errors="replace")).hexdigest()


def estimate_domain_rating(position: int) -> float:
    """
    Estimate domain authority from SERP position.
    Proxy metric since we don't use Ahrefs.
    Position 1 → ~90 DR, Position 20 → ~40 DR (heuristic).
    """
    # Sigmoid-like decay: position 1 = 90, position 20 = 40
    return max(40.0, 90.0 - (position - 1) * 2.5)
