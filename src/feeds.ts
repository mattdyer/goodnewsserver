import Parser from 'rss-parser';
import { analyzeSentiment } from './sentiment';

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  category: string;
  sentiment?: {
    score: number;
    isPositive: boolean;
    label: string;
  };
}

const RSS_FEEDS = [
  { name: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { name: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'NYT Technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'Wired Science', url: 'https://www.wired.com/feed/category/science/latest/rss' },
  { name: 'Al Jazeera Science', url: 'https://www.aljazeera.com/science-and-technology/rss' },
];

export const RSS_SOURCES = RSS_FEEDS.map(f => f.name);

const parser = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail', 'content:encoded'],
  },
});

interface CacheEntry {
  articles: NewsArticle[];
  timestamp: number;
}

let feedCache: CacheEntry | null = null;
const CACHE_TTL = 5 * 60 * 1000;

function generateArticleId(title: string, link: string): string {
  const str = `${title}-${link}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export async function fetchAllFeeds(filter?: 'positive'): Promise<NewsArticle[]> {
  const now = Date.now();
  
  if (feedCache && (now - feedCache.timestamp) < CACHE_TTL) {
    return filterPositive(filter, feedCache.articles);
  }
  
  const articles: NewsArticle[] = [];
  
  const fetchPromises = RSS_FEEDS.map(async (feed) => {
    try {
      const feedData = await parser.parseURL(feed.url);
      const feedArticles = (feedData.items || []).map((item) => {
        const title = item.title || '';
        const description = item.contentSnippet || item.content || item.summary || '';
        const sentiment = analyzeSentiment(`${title} ${description}`);
        
        return {
          id: generateArticleId(title, item.link || item.guid || ''),
          title,
          link: item.link || item.guid || '',
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          description,
          source: feed.name,
          category: feedData.title || '',
          sentiment: {
            score: sentiment.score,
            isPositive: sentiment.isPositive,
            label: sentiment.label,
          },
        };
      });
      articles.push(...feedArticles);
    } catch (error) {
      console.error(`Error fetching feed ${feed.name}:`, error);
    }
  });

  await Promise.all(fetchPromises);
  
  const sortedArticles = articles.sort((a, b) => {
    const dateA = new Date(a.pubDate).getTime();
    const dateB = new Date(b.pubDate).getTime();
    return dateB - dateA;
  });
  
  feedCache = {
    articles: sortedArticles,
    timestamp: now,
  };
  
  return filterPositive(filter, sortedArticles);
}

function filterPositive(filter: 'positive' | undefined, articles: NewsArticle[]): NewsArticle[] {
  if (filter !== 'positive') {
    return articles;
  }
  
  return articles
    .filter(a => a.sentiment?.isPositive)
    .sort((a, b) => (b.sentiment?.score || 0) - (a.sentiment?.score || 0));
}

export async function getArticleById(id: string): Promise<NewsArticle | undefined> {
  const articles = await fetchAllFeeds();
  return articles.find(a => a.id === id);
}

export function clearCache(): void {
  feedCache = null;
}