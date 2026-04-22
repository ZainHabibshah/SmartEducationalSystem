import feedparser
feed = feedparser.parse("https://feeds.bbci.co.uk/news/technology/rss.xml")
print(len(feed.entries))  # Should be >0