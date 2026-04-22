from flask import jsonify, request
from datetime import datetime, timedelta, timezone
import requests
import os
import json
import feedparser
import traceback
import re
from bs4 import BeautifulSoup
import urllib.parse
import xml.etree.ElementTree as ET

from database import connect_to_mongodb
from . import news_bp

REQUEST_TIMEOUT = 20

# Groq (OpenAI-compatible) configuration (already used elsewhere in Backend)
GROQ_API_KEY = (os.getenv("GROQ_API_KEY") or "").strip() or None
GROQ_CHAT_MODEL = (os.getenv("GROQ_CHAT_MODEL") or "llama-3.3-70b-versatile").strip()
GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"

# Optional NewsAPI fallback (kept for resiliency)
NEWS_API_KEY = (os.environ.get("NEWS_API_KEY") or "").strip() or None  # Get from newsapi.org
NEWS_API_URL = "https://newsapi.org/v2/everything"

# Mongo document id for the curated daily news cache
DAILY_NEWS_DOC_ID = "educational-news"
DAILY_NEWS_TTL_HOURS = 24

# Debug/observability: last candidate fetch stats (in-memory)
_last_candidate_stats = {
    "fetched_at": None,
    "rss": {},
    "html": {},
    "total_candidates": 0,
}

# Candidate sources (prefer RSS when available)
RSS_SOURCES = [
    # BBC RSS feeds
    ("BBC News - Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml"),
    ("BBC News - Education", "https://feeds.bbci.co.uk/news/education/rss.xml"),
    ("BBC News - Science & Environment", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"),
    # TIME (general + topical feeds; LLM will filter for education/tech/innovation)
    ("TIME", "https://time.com/feed/"),
    ("TIME - Technology", "https://time.com/tag/technology/feed/"),
    ("TIME - Education", "https://time.com/tag/education/feed/"),
]

# Government of Pakistan education-related pages (no public RSS; we extract links as candidates)
HTML_SOURCES = [
    ("HEC Pakistan - Announcements", "https://www.hec.gov.pk/english/HECAnnouncements/Pages/Announcements.aspx"),
    ("HEC Pakistan - News", "https://www.hec.gov.pk/english/news/news/Pages/default.aspx"),
    ("MoFEPT Pakistan - Latest News", "https://mofept.gov.pk/LatestNews"),
]

# Fallback educational news (used when API fails or no API key)
FALLBACK_NEWS = [
    {
        'id': 1,
        'title': 'AI and Machine Learning Revolutionizing Modern Education',
        'url': 'https://www.edweek.org/technology/ai-in-education',
        'source': 'Education Week',
        'publishedAt': datetime.now().isoformat(),
        'description': 'Discover how artificial intelligence is transforming classrooms and personalizing learning experiences.'
    },
    {
        'id': 2,
        'title': 'Digital Literacy: Essential Skills for 21st Century Students',
        'url': 'https://www.edsurge.com/news/digital-literacy',
        'source': 'EdSurge',
        'publishedAt': datetime.now().isoformat(),
        'description': 'Understanding the critical importance of digital literacy in today\'s educational landscape.'
    },
    {
        'id': 3,
        'title': 'Hybrid Learning Models Show Promising Results',
        'url': 'https://www.insidehighered.com/news/hybrid-learning',
        'source': 'Inside Higher Ed',
        'publishedAt': datetime.now().isoformat(),
        'description': 'Research indicates that hybrid learning approaches can enhance student engagement and outcomes.'
    },
    {
        'id': 4,
        'title': 'Student Mental Health Support Gains Priority in Schools',
        'url': 'https://www.edutopia.org/student-mental-health',
        'source': 'Edutopia',
        'publishedAt': datetime.now().isoformat(),
        'description': 'Schools nationwide are implementing comprehensive mental health programs for students.'
    },
    {
        'id': 5,
        'title': 'STEM Education Initiatives Drive Student Success',
        'url': 'https://www.scientificamerican.com/education/stem',
        'source': 'Scientific American',
        'publishedAt': datetime.now().isoformat(),
        'description': 'New STEM programs are helping students develop critical thinking and problem-solving skills.'
    }
]

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _dt_to_iso(dt: datetime) -> str:
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _parse_iso_or_none(value):
    if not value:
        return None
    try:
        # Handles "2026-04-20T..." and "...+00:00"
        return datetime.fromisoformat(value)
    except Exception:
        return None


def _get_db_or_response():
    db = connect_to_mongodb()
    if db is None:
        return None, (jsonify({"error": "MongoDB connection not available"}), 500)
    return db, None


def _news_collection(db):
    # Keep news isolated in its own collection
    return db["daily_news"]


def _load_cached_doc(db):
    try:
        coll = _news_collection(db)
        return coll.find_one({"_id": DAILY_NEWS_DOC_ID})
    except Exception:
        return None


def _is_doc_fresh(doc) -> bool:
    if not doc:
        return False
    expires_at = doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = _parse_iso_or_none(expires_at)
    if isinstance(expires_at, datetime):
        # Normalize naive datetimes as UTC
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return _now_utc() < expires_at.astimezone(timezone.utc)
    return False


def _extract_json_object(text: str) -> str:
    """
    Extract JSON from LLM output that may include code fences or pre/post text.
    Returns a string expected to be a JSON array.
    """
    if not text:
        return ""
    t = text.strip()
    # Strip markdown fences if present
    t = re.sub(r"^\s*```(?:json)?\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*```\s*$", "", t)
    # Prefer the first JSON array in the text
    m = re.search(r"(\[\s*\{[\s\S]*\}\s*\])", t)
    if m:
        return m.group(1).strip()
    # Fallback: return full stripped text (may still be JSON)
    return t


def _groq_chat_complete(prompt: str, max_tokens: int = 900, timeout: int = 60):
    """Groq OpenAI-compatible chat completion. Returns text or None."""
    if not GROQ_API_KEY:
        return None
    try:
        response = requests.post(
            GROQ_CHAT_COMPLETIONS_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_CHAT_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_tokens": max_tokens,
            },
            timeout=timeout,
        )
        if response.status_code != 200:
            print(f"⚠️  News: Groq HTTP {response.status_code}: {response.text[:600]}")
            return None
        data = response.json()
        return (data["choices"][0]["message"]["content"] or "").strip()
    except Exception as e:
        print(f"⚠️  News: Groq request failed: {e}")
        traceback.print_exc()
        return None


def _safe_get(url: str, timeout: int = REQUEST_TIMEOUT, retries: int = 2):
    """Robust GET with retries and SSL fallback."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
    }
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=headers, timeout=timeout)
            if resp.status_code == 200:
                return resp
            # If 404/403/500, don't retry with verify=False
            if resp.status_code in [403, 404, 410, 500, 502, 503]:
                print(f"⚠️  News: {url} returned {resp.status_code}")
                return None
        except requests.exceptions.SSLError as e:
            # Retry without verification
            try:
                print(f"⚠️  News: SSL error on {url}, retrying without verify")
                resp = requests.get(url, headers=headers, timeout=timeout, verify=False)
                if resp.status_code == 200:
                    return resp
            except Exception:
                pass
        except Exception as e:
            print(f"⚠️  News: Request failed ({attempt+1}/{retries}) for {url}: {e}")
            if attempt == retries - 1:
                return None
    return None


def _parse_rss_feed(url: str, source_name: str, limit: int = 25):
    """Parse RSS/Atom feed using feedparser."""
    try:
        feed = feedparser.parse(url)  # Removed faulty 'agent' parameter
        if feed.bozo:
            print(f"⚠️  News: feedparser warning for {source_name}: {feed.bozo_exception}")
        
        items = []
        for entry in feed.entries[:limit]:
            title = entry.get("title", "").strip()
            link = entry.get("link", "").strip()
            if not title or not link:
                continue
            pub_date = entry.get("published", "") or entry.get("pubDate", "") or entry.get("updated", "")
            description = entry.get("summary", "") or entry.get("description", "") or ""
            # Clean HTML from description (requires BeautifulSoup)
            if description and 'BeautifulSoup' in globals():
                try:
                    soup = BeautifulSoup(description, "html.parser")
                    description = soup.get_text(separator=" ").strip()[:500]
                except:
                    pass
            
            items.append({
                "title": title,
                "url": link,
                "source": source_name,
                "publishedAt": pub_date,
                "description": description,
            })
        return items
    except Exception as e:
        print(f"❌ News: Failed to parse RSS {source_name}: {e}")
        traceback.print_exc()
        return []


def _extract_links_from_html_bs4(html_text: str, base_url: str, source_name: str, limit: int = 25):
    """Extract article links using BeautifulSoup (more reliable)."""
    if not html_text:
        return []
    try:
        soup = BeautifulSoup(html_text, "html.parser")
        candidates = []
        # Look for <a> tags that might be news/announcement links
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            text = a.get_text(strip=True)
            if not text or len(text) < 15:
                continue
            # Skip non-http links
            if href.startswith(("javascript:", "#", "mailto:", "tel:")):
                continue
            # Make absolute URL
            if href.startswith("/"):
                parsed_base = urllib.parse.urlparse(base_url)
                href = f"{parsed_base.scheme}://{parsed_base.netloc}{href}"
            elif not href.startswith(("http://", "https://")):
                href = urllib.parse.urljoin(base_url, href)
            
            # Heuristic: only keep if link text or URL contains education-related keywords
            lower_text = text.lower()
            lower_href = href.lower()
            keywords = ["university", "universities", "hec", "education", "students", "faculty", 
                        "research", "innovation", "technology", "degree", "admission", "scholar",
                        "announcement", "news", "press", "update"]
            if not any(k in lower_text or k in lower_href for k in keywords):
                continue
            
            candidates.append({
                "title": text[:200],
                "url": href,
                "source": source_name,
                "publishedAt": "",
                "description": "",
            })
        
        # Deduplicate by URL
        seen = set()
        unique = []
        for c in candidates:
            if c["url"] in seen:
                continue
            seen.add(c["url"])
            unique.append(c)
            if len(unique) >= limit:
                break
        return unique
    except Exception as e:
        print(f"❌ News: BeautifulSoup extraction failed for {source_name}: {e}")
        # Fallback to regex method
        return []

def fetch_educational_news():
    """
    Fetch candidate educational/tech/innovation news from:
    - RSS sources (using feedparser)
    - HTML pages (using BeautifulSoup)
    - Optional NewsAPI
    """
    global _last_candidate_stats
    candidates = []
    rss_counts = {}
    html_counts = {}

    # 1) RSS sources using feedparser
    for source_name, rss_url in RSS_SOURCES:
        print(f"📡 Fetching RSS: {source_name} from {rss_url}")
        items = _parse_rss_feed(rss_url, source_name, limit=25)
        rss_counts[source_name] = len(items)
        candidates.extend(items)
        print(f"   → Got {len(items)} items")

    # 2) HTML sources using BeautifulSoup
    for source_name, page_url in HTML_SOURCES:
        print(f"🌐 Fetching HTML: {source_name} from {page_url}")
        resp = _safe_get(page_url, timeout=REQUEST_TIMEOUT)
        if not resp or resp.status_code != 200:
            html_counts[source_name] = 0
            print(f"   → Failed (status {resp.status_code if resp else 'connection error'})")
            continue
        items = _extract_links_from_html_bs4(resp.text, page_url, source_name, limit=25)
        html_counts[source_name] = len(items)
        candidates.extend(items)
        print(f"   → Extracted {len(items)} links")

    # 3) NewsAPI (if key exists) – broaden query and domains
    if NEWS_API_KEY:
        try:
            params = {
                "apiKey": NEWS_API_KEY,
                "q": "education OR edtech OR university OR students OR innovation OR technology OR AI in education",
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": 30,
                "domains": "bbc.com,bbc.co.uk,time.com,edweek.org,edsurge.com,insidehighered.com,chronicle.com,hec.gov.pk,mofept.gov.pk",
            }
            print("📰 Fetching NewsAPI...")
            resp = requests.get(NEWS_API_URL, params=params, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json()
                for article in data.get("articles", [])[:30]:
                    title = article.get("title") or ""
                    url = article.get("url") or ""
                    if not title or not url:
                        continue
                    candidates.append({
                        "title": title,
                        "url": url,
                        "source": article.get("source", {}).get("name", "NewsAPI"),
                        "publishedAt": article.get("publishedAt") or "",
                        "description": (article.get("description") or "")[:500],
                    })
                print(f"   → Added {len(data.get('articles', []))} candidates from NewsAPI")
            else:
                print(f"   → NewsAPI returned {resp.status_code}")
        except Exception as e:
            print(f"⚠️ NewsAPI error: {e}")

    # Deduplicate by URL (and title as fallback)
    seen_urls = set()
    seen_titles = set()
    deduped = []
    for c in candidates:
        url = c.get("url", "")
        title = c.get("title", "")
        if url in seen_urls:
            continue
        # Avoid near-duplicate titles from same source
        title_lower = title.lower()
        if title_lower in seen_titles and len(title) > 30:
            continue
        seen_urls.add(url)
        seen_titles.add(title_lower)
        deduped.append(c)

    _last_candidate_stats = {
        "fetched_at": _dt_to_iso(_now_utc()),
        "rss": rss_counts,
        "html": html_counts,
        "total_candidates": len(deduped),
    }

    print(f"✅ Total candidates after dedup: {len(deduped)}")
    if len(deduped) == 0:
        print("⚠️ WARNING: No candidates fetched! Check network, RSS URLs, and HTML sources.")
    return deduped[:60]  # return more for LLM to choose from


def _curate_with_llm(candidates):
    """
    Ask LLM to pick top 5 education/tech/innovation items and produce short summaries.
    Must output JSON array of 5 objects: {id,title,url,source,publishedAt,description}
    """
    if not candidates:
        return None

    # If no LLM key configured, skip LLM curation
    if not GROQ_API_KEY:
        return None

    # Keep candidate payload small/clean
    compact_candidates = []
    for c in candidates[:40]:
        compact_candidates.append(
            {
                "title": (c.get("title") or "")[:240],
                "url": c.get("url") or "",
                "source": c.get("source") or "",
                "publishedAt": (c.get("publishedAt") or "")[:80],
                "description": (c.get("description") or "")[:300],
            }
        )

    prompt = f"""
You are curating an "Educational News" box for a university app dashboard.

TASK:
- Select EXACTLY 5 items from the provided candidates.
- Focus on: education, universities, students, edtech, AI in education, research, innovation, STEM, new technologies.
- Prefer authoritative sources (BBC, TIME, HEC Pakistan). Avoid duplicates.
- Source diversity requirement:
  - If there is at least one candidate from "TIME" (including TIME - Technology/Education), include at least 1 TIME item.
  - If there is at least one candidate from "HEC Pakistan" or "MoFEPT Pakistan", include at least 1 Pakistan government item.
  - If a required source is not present in candidates, fill with the best remaining items.

OUTPUT FORMAT (STRICT):
Return ONLY valid JSON (no markdown, no commentary) as a JSON array of 5 objects with these keys:
  id (1..5), title, url, source, publishedAt, description

RULES:
- url MUST come from a candidate url (do not invent links).
- title MUST be based on the candidate title (you may shorten lightly).
- description: 1-2 sentences, plain English, no hype, no emojis.
- If publishedAt is missing in the candidate, set it to an empty string.

CANDIDATES JSON:
{json.dumps(compact_candidates, ensure_ascii=False)}
""".strip()

    raw = _groq_chat_complete(prompt, max_tokens=900, timeout=70)
    if not raw:
        return None

    json_text = _extract_json_object(raw)
    try:
        parsed = json.loads(json_text)
        if not isinstance(parsed, list) or len(parsed) != 5:
            return None
        cleaned = []
        for i, item in enumerate(parsed[:5], start=1):
            if not isinstance(item, dict):
                return None
            cleaned.append(
                {
                    "id": i,
                    "title": (item.get("title") or "").strip()[:240],
                    "url": (item.get("url") or "").strip(),
                    "source": (item.get("source") or "").strip()[:120],
                    "publishedAt": (item.get("publishedAt") or "").strip()[:80],
                    "description": (item.get("description") or "").strip()[:400],
                }
            )
        # Basic validation: require url + title
        if any((not x["title"] or not x["url"]) for x in cleaned):
            return None
        # Enforce minimal source diversity if candidates contain those sources.
        adjusted = _ensure_source_diversity(cleaned, candidates)
        return adjusted
    except Exception:
        return None


def _ensure_source_diversity(curated_items, candidates):
    """
    Ensure at least 1 TIME item and 1 Pakistan govt item (HEC/MoFEPT) if those exist in candidates.
    If missing, rebuild the final 5-item list by injecting required sources first, then filling with the curated list.
    """
    try:
        if not curated_items:
            curated_items = []
        if not candidates:
            return curated_items

        def is_time(src: str) -> bool:
            s = (src or "").lower()
            return s.startswith("time") or s == "time" or s.startswith("time -")

        def is_pak_gov(src: str) -> bool:
            s = (src or "").lower()
            return ("hec pakistan" in s) or ("mofept pakistan" in s) or ("mofept" in s)

        candidate_time = [c for c in candidates if is_time(c.get("source")) and c.get("url") and c.get("title")]
        candidate_pak = [c for c in candidates if is_pak_gov(c.get("source")) and c.get("url") and c.get("title")]

        needs_time = bool(candidate_time)
        needs_pak = bool(candidate_pak)
        has_time = any(is_time(x.get("source")) for x in curated_items)
        has_pak = any(is_pak_gov(x.get("source")) for x in curated_items)

        if (not needs_time or has_time) and (not needs_pak or has_pak):
            # Already meets requirements (or requirements not applicable)
            out = list(curated_items)[:5]
            for i, item in enumerate(out, start=1):
                item["id"] = i
            return out

        used_urls = set()
        out = []

        def push_item(item):
            url = (item.get("url") or "").strip()
            title = (item.get("title") or "").strip()
            if not url or not title:
                return
            if url in used_urls:
                return
            used_urls.add(url)
            out.append(
                {
                    "id": len(out) + 1,
                    "title": title[:240],
                    "url": url,
                    "source": (item.get("source") or "").strip()[:120],
                    "publishedAt": (item.get("publishedAt") or "").strip()[:80],
                    "description": (item.get("description") or "").strip()[:400],
                }
            )

        # Inject required sources first (if missing)
        if needs_pak and not has_pak:
            push_item(candidate_pak[0])
        if needs_time and not has_time:
            push_item(candidate_time[0])

        # Then keep as much of curated selection as possible
        for it in curated_items:
            if len(out) >= 5:
                break
            push_item(it)

        # Fill remaining from candidates (any source), keeping uniqueness
        for it in candidates:
            if len(out) >= 5:
                break
            push_item(it)

        # Renumber ids 1..5
        out = out[:5]
        for i, item in enumerate(out, start=1):
            item["id"] = i
        return out
    except Exception as e:
        print(f"⚠️  News: source diversity adjustment failed: {e}")
        traceback.print_exc()
        return curated_items


def _build_daily_news_items():
    candidates = fetch_educational_news()
    if not candidates:
        print("❌ No candidates found, using hardcoded fallback news.")
        return FALLBACK_NEWS
    
    curated = _curate_with_llm(candidates)
    if curated:
        return curated
    
    # LLM failed, return first 5 candidates (not hardcoded fallback)
    print("⚠️ LLM curation failed, returning first 5 candidates.")
    out = []
    for idx, c in enumerate(candidates[:5], start=1):
        out.append({
            "id": idx,
            "title": c.get("title", "No Title"),
            "url": c.get("url", "#"),
            "source": c.get("source", "Unknown"),
            "publishedAt": c.get("publishedAt", ""),
            "description": c.get("description", ""),
        })
    return _ensure_source_diversity(out, candidates)

@news_bp.route('/educational-news', methods=['GET'])
def get_educational_news():
    """
    Get top 5 educational news articles
    Updates automatically once per day
    GET /educational-news
    """
    try:
        db, error_response = _get_db_or_response()
        if error_response:
            return error_response

        force_refresh = (request.args.get("force_refresh") or "").strip() in {"1", "true", "True", "yes", "YES"}

        cached = _load_cached_doc(db)
        if (not force_refresh) and _is_doc_fresh(cached):
            news_data = cached.get("items") or []
            last_updated = cached.get("last_updated")
        else:
            print("📰 Refreshing daily educational news (24h cache expired or forced)...")
            news_data = _build_daily_news_items()
            now = _now_utc()
            expires = now + timedelta(hours=DAILY_NEWS_TTL_HOURS)

            doc = {
                "_id": DAILY_NEWS_DOC_ID,
                "items": news_data,
                "last_updated": _dt_to_iso(now),
                "expires_at": _dt_to_iso(expires),
                "ttl_hours": DAILY_NEWS_TTL_HOURS,
                "sources": {
                    "rss": [u for _, u in RSS_SOURCES],
                    "html": [u for _, u in HTML_SOURCES],
                },
            }
            try:
                _news_collection(db).update_one({"_id": DAILY_NEWS_DOC_ID}, {"$set": doc}, upsert=True)
            except Exception as e:
                print(f"⚠️  News: failed to store daily news in MongoDB: {e}")

            last_updated = doc.get("last_updated")

        return jsonify({
            'success': True,
            'news': news_data,
            'count': len(news_data),
            'last_updated': last_updated
        }), 200
        
    except Exception as e:
        print(f"❌ Error in get_educational_news: {e}")
        traceback.print_exc()
        # Return fallback news even on error
        return jsonify({
            'success': True,
            'news': FALLBACK_NEWS,
            'count': len(FALLBACK_NEWS),
            'last_updated': datetime.now().isoformat()
        }), 200

@news_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        db = connect_to_mongodb()
        mongo_status = "connected" if db is not None else "disconnected"
        doc = _load_cached_doc(db) if db is not None else None
        fresh = _is_doc_fresh(doc)
        last_updated = (doc or {}).get("last_updated")
        expires_at = (doc or {}).get("expires_at")
    except Exception:
        mongo_status = "disconnected"
        fresh = False
        last_updated = None
        expires_at = None
    return jsonify({
        'status': 'healthy',
        'service': 'news',
        "mongodb": mongo_status,
        "cache_fresh": fresh,
        "last_updated": last_updated,
        "expires_at": expires_at,
        "ttl_hours": DAILY_NEWS_TTL_HOURS,
        "llm_enabled": bool(GROQ_API_KEY),
        "last_candidate_fetch": _last_candidate_stats,
        'timestamp': datetime.now().isoformat()
    }), 200
