import asyncio
import httpx
from bs4 import BeautifulSoup
import re

async def extract(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    async with httpx.AsyncClient(timeout=15.0, headers=headers, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, 'lxml')
    print("Soup title:", soup.title.string if soup.title else "None")
    
    title_tag = soup.find('meta', property='og:title') or soup.find('meta', attrs={'name': 'title'})
    title = title_tag['content'] if title_tag else soup.title.string if soup.title else ""
    if title.endswith(" - YouTube"):
        title = title[:-10]
    print("Title:", title)

    desc_tag = soup.find('meta', property='og:description') or soup.find('meta', attrs={'name': 'description'})
    description = desc_tag['content'] if desc_tag else ""
    print("Desc:", description)

asyncio.run(extract("https://youtu.be/ytjD4f_I0sc?si=0aMW0td4yDjhGm0x"))
