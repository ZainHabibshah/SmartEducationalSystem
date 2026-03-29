from flask import Blueprint, jsonify
from datetime import datetime, timedelta
import requests
import os
from . import news_bp

# Cache for news data
news_cache = {
    'data': None,
    'last_updated': None
}

# NewsAPI configuration (free tier allows 100 requests/day)
NEWS_API_KEY = os.environ.get('NEWS_API_KEY', 'your_api_key_here')  # Get from newsapi.org
NEWS_API_URL = 'https://newsapi.org/v2/everything'

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

def should_refresh_cache():
    """Check if cache should be refreshed (once per day)"""
    if news_cache['last_updated'] is None:
        return True
    
    # Refresh if more than 24 hours old
    time_diff = datetime.now() - news_cache['last_updated']
    return time_diff > timedelta(hours=24)

def fetch_educational_news():
    """Fetch educational news from NewsAPI"""
    try:
        # Parameters for educational news
        params = {
            'apiKey': NEWS_API_KEY,
            'q': 'education OR learning OR students OR university OR school',
            'language': 'en',
            'sortBy': 'publishedAt',
            'pageSize': 5,
            'domains': 'edweek.org,edsurge.com,insidehighered.com,edutopia.org,chronicle.com'
        }
        
        response = requests.get(NEWS_API_URL, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('status') == 'ok' and data.get('articles'):
                articles = data['articles'][:5]  # Get top 5
                
                # Format articles
                formatted_news = []
                for idx, article in enumerate(articles):
                    formatted_news.append({
                        'id': idx + 1,
                        'title': article.get('title', 'No Title'),
                        'url': article.get('url', '#'),
                        'source': article.get('source', {}).get('name', 'Unknown Source'),
                        'publishedAt': article.get('publishedAt', datetime.now().isoformat()),
                        'description': article.get('description', '')
                    })
                
                return formatted_news
        
        # If API fails, return fallback news
        print(f"⚠️ NewsAPI returned status {response.status_code}, using fallback news")
        return FALLBACK_NEWS
        
    except requests.exceptions.Timeout:
        print("⚠️ NewsAPI request timeout, using fallback news")
        return FALLBACK_NEWS
    except Exception as e:
        print(f"❌ Error fetching news from API: {e}")
        return FALLBACK_NEWS

@news_bp.route('/educational-news', methods=['GET'])
def get_educational_news():
    """
    Get top 5 educational news articles
    Updates automatically once per day
    GET /educational-news
    """
    try:
        # Check if we need to refresh the cache
        if should_refresh_cache():
            print("📰 Fetching fresh educational news...")
            news_data = fetch_educational_news()
            
            # Update cache
            news_cache['data'] = news_data
            news_cache['last_updated'] = datetime.now()
            
            print(f"✅ Cached {len(news_data)} news articles")
        else:
            print("📰 Using cached news (still fresh)")
            news_data = news_cache['data']
        
        return jsonify({
            'success': True,
            'news': news_data,
            'count': len(news_data),
            'last_updated': news_cache['last_updated'].isoformat() if news_cache['last_updated'] else None
        }), 200
        
    except Exception as e:
        print(f"❌ Error in get_educational_news: {e}")
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
    return jsonify({
        'status': 'healthy',
        'service': 'news',
        'cache_age': (datetime.now() - news_cache['last_updated']).seconds if news_cache['last_updated'] else None,
        'timestamp': datetime.now().isoformat()
    }), 200
