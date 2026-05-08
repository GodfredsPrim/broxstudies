"""Fetch news and motivation articles from external RSS feeds and free APIs."""
import asyncio
import hashlib
import logging
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from xml.etree import ElementTree as ET

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

CACHE_TTL = 4 * 3600  # 4 hours

_cache: dict[str, Any] = {
    "articles": [],
    "fetched_at": 0.0,
}

_RSS_SOURCES = [
    {
        "url": "https://feeds.bbci.co.uk/news/education/rss.xml",
        "category": "education",
        "label": "BBC Education",
    },
    {
        "url": "https://www.myjoyonline.com/feed/",
        "category": "education",
        "label": "MyJoyOnline Ghana",
    },
    {
        "url": "https://www.graphic.com.gh/feed",
        "category": "education",
        "label": "Graphic Online Ghana",
    },
]


def _make_id(key: str) -> int:
    """Deterministic integer ID from a string key, guaranteed > 999999."""
    return 1_000_000 + (int(hashlib.md5(key.encode()).hexdigest(), 16) % 8_999_999)


def _today_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_rfc_date(raw: str) -> str:
    """Convert RFC 2822 or ISO date to a consistent ISO 8601 UTC string."""
    try:
        dt = parsedate_to_datetime(raw)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        pass
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        pass
    return _today_iso()


def _strip_html(html: str) -> str:
    return BeautifulSoup(html, "html.parser").get_text(separator=" ").strip()


async def _fetch_rss(client: httpx.AsyncClient, url: str, category: str, label: str) -> list[dict]:
    articles = []
    try:
        resp = await client.get(url, timeout=12)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        channel = root.find("channel")
        items = channel.findall("item") if channel is not None else root.findall(".//item")
        for item in items[:12]:
            title = (item.findtext("title") or "").strip()
            desc = (item.findtext("description") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_raw = (item.findtext("pubDate") or "").strip()
            if not title:
                continue
            content = _strip_html(desc) if desc else title
            articles.append({
                "id": _make_id(f"{label}:{link or title}"),
                "title": title,
                "content": content,
                "category": category,
                "image_url": None,
                "author_name": label,
                "is_published": True,
                "created_at": _parse_rfc_date(pub_raw) if pub_raw else _today_iso(),
                "updated_at": _parse_rfc_date(pub_raw) if pub_raw else _today_iso(),
                "source": "external",
                "source_url": link or None,
            })
    except Exception as e:
        logger.warning(f"RSS fetch failed [{label}]: {e}")
    return articles


async def _fetch_zenquotes(client: httpx.AsyncClient) -> list[dict]:
    """Fetch motivational quotes from ZenQuotes (free, no auth)."""
    articles = []
    try:
        resp = await client.get("https://zenquotes.io/api/quotes", timeout=12)
        resp.raise_for_status()
        quotes = resp.json()
        today = _today_iso()
        for q in quotes[:20]:
            text = (q.get("q") or "").strip()
            author = (q.get("a") or "Unknown").strip()
            if not text or text == "...":
                continue
            short_title = f'"{text}"' if len(text) <= 90 else f'"{text[:87]}…"'
            articles.append({
                "id": _make_id(f"zenquotes:{text[:100]}"),
                "title": short_title,
                "content": f'"{text}"\n\n— {author}',
                "category": "motivation",
                "image_url": None,
                "author_name": author,
                "is_published": True,
                "created_at": today,
                "updated_at": today,
                "source": "external",
                "source_url": "https://zenquotes.io",
            })
    except Exception as e:
        logger.warning(f"ZenQuotes fetch failed: {e}")
    return articles


async def _fetch_quotable(client: httpx.AsyncClient) -> list[dict]:
    """Fetch motivational quotes from Quotable.io (free, no auth)."""
    articles = []
    try:
        resp = await client.get(
            "https://api.quotable.io/quotes",
            params={"tags": "education|motivation|success|wisdom", "limit": 20},
            timeout=12,
        )
        resp.raise_for_status()
        data = resp.json()
        today = _today_iso()
        for q in (data.get("results") or []):
            text = (q.get("content") or "").strip()
            author = (q.get("author") or "Unknown").strip()
            if not text:
                continue
            short_title = f'"{text}"' if len(text) <= 90 else f'"{text[:87]}…"'
            articles.append({
                "id": _make_id(f"quotable:{text[:100]}"),
                "title": short_title,
                "content": f'"{text}"\n\n— {author}',
                "category": "motivation",
                "image_url": None,
                "author_name": author,
                "is_published": True,
                "created_at": today,
                "updated_at": today,
                "source": "external",
                "source_url": "https://quotable.io",
            })
    except Exception as e:
        logger.warning(f"Quotable.io fetch failed: {e}")
    return articles


async def fetch_all() -> list[dict]:
    """Fetch from all external sources concurrently. Returns combined list."""
    async with httpx.AsyncClient(
        follow_redirects=True,
        headers={"User-Agent": "BroxStudies/1.0 EducationNewsBot"},
    ) as client:
        tasks = [
            _fetch_zenquotes(client),
            _fetch_quotable(client),
            *[_fetch_rss(client, s["url"], s["category"], s["label"]) for s in _RSS_SOURCES],
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    all_articles: list[dict] = []
    for r in results:
        if isinstance(r, list):
            all_articles.extend(r)
    return all_articles


async def get_external_articles() -> list[dict]:
    """Return cached external articles, refreshing the cache when stale."""
    now = time.monotonic()
    if now - _cache["fetched_at"] < CACHE_TTL and _cache["articles"]:
        return _cache["articles"]
    articles = await fetch_all()
    _cache["articles"] = articles
    _cache["fetched_at"] = now
    logger.info(f"External news cache refreshed: {len(articles)} articles")
    return articles


async def refresh_loop() -> None:
    """Background task: refresh external news every CACHE_TTL seconds."""
    while True:
        try:
            await asyncio.sleep(CACHE_TTL)
            articles = await fetch_all()
            _cache["articles"] = articles
            _cache["fetched_at"] = time.monotonic()
            logger.info(f"Background news refresh: {len(articles)} articles")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Background news refresh error: {e}")
