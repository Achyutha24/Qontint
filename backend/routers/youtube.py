from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

from services.content_generator import call_gemini
import json

router = APIRouter(prefix="/api/v1/youtube", tags=["YouTube Predictor"])

class YouTubePredictRequest(BaseModel):
    title: str
    description: str
    tags: List[str]

class YouTubePredictResponse(BaseModel):
    seoScore: float
    viralityScore: float
    engagementScore: float
    thumbnailScore: float
    noveltyScore: float
    rankEstimate: int
    views24h: int
    views7d: int
    views30d: int
    recs: List[str]
    verdict: str

class YouTubeExtractRequest(BaseModel):
    url: str

import httpx
from bs4 import BeautifulSoup
import re

@router.post("/extract")
async def extract_youtube_metadata(req: YouTubeExtractRequest):
    try:
        # Use httpx to fetch the actual YouTube page HTML
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
        async with httpx.AsyncClient(timeout=15.0, headers=headers, follow_redirects=True) as client:
            resp = await client.get(req.url)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, 'html.parser')

        # Extract title
        title_tag = soup.find('meta', property='og:title') or soup.find('meta', attrs={'name': 'title'})
        title = title_tag['content'] if title_tag else soup.title.string if soup.title else ""
        if title and title.endswith(" - YouTube"):
            title = title[:-10]

        # Extract description
        desc_tag = soup.find('meta', property='og:description') or soup.find('meta', attrs={'name': 'description'})
        description = desc_tag['content'] if desc_tag else ""

        # Extract tags
        tags = []
        keywords_tag = soup.find('meta', attrs={'name': 'keywords'})
        if keywords_tag and keywords_tag.get('content'):
            tags = [t.strip() for t in keywords_tag['content'].split(',') if t.strip()]

        if not tags:
            # Fallback: extract hashtags from description
            tags = [t.replace('#', '') for t in re.findall(r'#[a-zA-Z0-9_]+', description)]
            if not tags:
                tags = ["youtube", "video"]
                
        # oEmbed fallback for title if it looks like a generic/consent page
        if not title or "Before you continue" in title or "YouTube" == title:
            try:
                async with httpx.AsyncClient(timeout=5.0) as oembed_client:
                    oembed_resp = await oembed_client.get(f"https://www.youtube.com/oembed?url={req.url}&format=json")
                    if oembed_resp.status_code == 200:
                        title = oembed_resp.json().get("title", title)
            except Exception:
                pass

        return {
            "title": title.strip() or "Untitled Video",
            "description": description.strip() or "No description provided.",
            "tags": tags[:20] # Limit to 20 tags max
        }
    except Exception as e:
        # Fallback if scraping fails
        try:
            # Final oEmbed fallback if main request fails completely
            async with httpx.AsyncClient(timeout=5.0) as oembed_client:
                oembed_resp = await oembed_client.get(f"https://www.youtube.com/oembed?url={req.url}&format=json")
                if oembed_resp.status_code == 200:
                    return {
                        "title": oembed_resp.json().get("title", "Unknown Title"),
                        "description": "Description could not be scraped.",
                        "tags": ["youtube", "video"]
                    }
        except Exception:
            pass
            
        return {
            "title": "Failed to extract title",
            "description": f"Could not scrape URL: {str(e)}",
            "tags": ["error", "scraping", "failed"]
        }

@router.post("/predict", response_model=YouTubePredictResponse)
async def predict_youtube(req: YouTubePredictRequest):
    prompt = f"""You are an expert YouTube SEO and viral marketing analyst. Analyze the following video metadata and predict its performance.
Title: {req.title}
Description: {req.description}
Tags: {', '.join(req.tags)}

Evaluate the potential based on keyword density, emotional hook, thumbnail potential (based on title), and semantic novelty.
Return ONLY a valid JSON object matching this schema (no markdown, no backticks, no other text):
{{
  "seoScore": (float 0-1),
  "viralityScore": (float 0-1),
  "engagementScore": (float 0-1),
  "thumbnailScore": (float 0-1),
  "noveltyScore": (float 0-1),
  "rankEstimate": (integer 1-50),
  "views24h": (integer),
  "views7d": (integer),
  "views30d": (integer),
  "recs": [(list of 3-5 string recommendations for improvement)],
  "verdict": (short string verdict, e.g. "Strong - Ready to Publish" or "Needs Work")
}}
"""
    try:
        content = await call_gemini(prompt)
        
        # Clean up possible markdown code blocks from the response
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        data = json.loads(content)
        return YouTubePredictResponse(**data)
    except Exception:
        # Deterministic fallback based on input analysis
        title_len = len(req.title)
        desc_len = len(req.description)
        tags_cnt = len(req.tags)
        
        seo_score = min(1.0, (title_len / 60.0) * 0.4 + (desc_len / 500.0) * 0.4 + (tags_cnt / 10.0) * 0.2)
        virality_score = min(1.0, seo_score * 0.8 + 0.1)
        engagement_score = min(1.0, (desc_len / 1000.0) * 0.5 + 0.3)
        thumbnail_score = min(1.0, seo_score * 0.9)
        novelty_score = min(1.0, (tags_cnt / 15.0) * 0.6 + 0.2)
        
        rank = max(1, min(50, int(50 - (seo_score * 49))))
        v24 = int(virality_score * 10000)

        # Generate intelligent, actionable recommendations from the data
        recs = []
        if title_len < 40:
            recs.append(f"Expand your title to 50–60 characters — currently only {title_len} chars. Longer titles rank better for long-tail queries.")
        elif title_len > 70:
            recs.append(f"Shorten your title below 70 characters to avoid truncation in search results (currently {title_len}).")
        else:
            recs.append("Title length is optimal (50–70 chars). Consider adding a power word or number if not already present.")
        
        if tags_cnt < 5:
            recs.append(f"Add more specific tags — you only have {tags_cnt}. Aim for 10–15 relevant tags mixing broad and niche terms.")
        elif tags_cnt < 10:
            recs.append(f"Good start with {tags_cnt} tags. Add {10 - tags_cnt} more niche long-tail tags to improve discoverability.")
        
        if desc_len < 150:
            recs.append("Write a detailed description (500+ words) with timestamps, keywords, and links. YouTube uses it for indexing.")
        elif desc_len < 500:
            recs.append("Expand your description beyond 500 characters. Include the target keyword in the first two sentences.")
        
        if not any(word in req.title.lower() for word in ['how', 'why', 'best', 'top', 'guide', 'tutorial', 'what', 'complete']):
            recs.append("Add a trigger word (How, Best, Top, Guide, Complete) to your title — they significantly boost CTR.")
        
        if seo_score > 0.7:
            verdict = "Strong — Ready to Publish"
        elif seo_score > 0.5:
            verdict = "Good — Minor Optimizations Recommended"
        else:
            verdict = "Needs Work — Improve Before Publishing"
        
        return YouTubePredictResponse(
            seoScore=round(seo_score, 2),
            viralityScore=round(virality_score, 2),
            engagementScore=round(engagement_score, 2),
            thumbnailScore=round(thumbnail_score, 2),
            noveltyScore=round(novelty_score, 2),
            rankEstimate=rank,
            views24h=v24,
            views7d=v24 * 5,
            views30d=v24 * 15,
            recs=recs[:5],
            verdict=verdict
        )
